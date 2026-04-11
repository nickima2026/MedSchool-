// =============================================================================
// MSIB.io — Auto-Capture Orchestration API
// File: api/auto-capture.js
//
// Orchestrates the full pipeline for recurring lecture series:
//   1. Check a YouTube channel for new videos (channel-monitor)
//   2. Fetch transcript for each new video (transcript)
//   3. Generate AI analysis (summarize)
//   4. Return structured results ready for storage
//
// This API is designed to be called by:
//   - A Cowork scheduled task (automated weekly capture)
//   - A manual trigger from the MSIB dashboard ("Check for new lectures")
//   - A cron job or webhook
//
// Usage: POST /api/auto-capture
// Body: {
//   "channelId": "UCNQP-M_3-PdPDvnICr2Fjpg",
//   "channelName": "PGR PCH — Primary Children's Pediatric Grand Rounds",
//   "targetCourse": "pediatrics",
//   "since": "2026-04-03T00:00:00Z",   // optional, defaults to 7 days ago
//   "processedIds": ["j-iVqWGal2k"],    // skip already-captured videos
//   "autoAnalyze": true,                 // run AI summarization (default true)
//   "dryRun": false                      // if true, just report what's new
// }
//
// Returns: {
//   ok, channelName, captured: [{
//     videoId, title, published, transcript, analysis, targetCourse, label
//   }], skipped[], errors[]
// }
// =============================================================================

export const config = { runtime: 'nodejs', maxDuration: 120 };

// ---------------------------------------------------------------------------
// Internal helpers — call our own APIs as functions (not HTTP round-trips)
// ---------------------------------------------------------------------------

const INNERTUBE_API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

const CLIENTS = [
  {
    name: 'ANDROID',
    context: {
      client: {
        clientName: 'ANDROID',
        clientVersion: '19.29.37',
        androidSdkVersion: 30,
        hl: 'en',
        gl: 'US',
      },
    },
    userAgent: 'com.google.android.youtube/19.29.37 (Linux; U; Android 11) gzip',
  },
  {
    name: 'TV_EMBEDDED',
    context: {
      client: {
        clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER',
        clientVersion: '2.0',
        hl: 'en',
        gl: 'US',
      },
      thirdParty: { embedUrl: 'https://www.google.com' },
    },
    userAgent: 'Mozilla/5.0 (SMART-TV; Linux; Tizen 5.0)',
  },
  {
    name: 'WEB',
    context: {
      client: {
        clientName: 'WEB',
        clientVersion: '2.20240313.05.00',
        hl: 'en',
        gl: 'US',
      },
    },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0',
  },
];

async function fetchTranscript(videoId) {
  for (const client of CLIENTS) {
    try {
      const playerResponse = await fetch(
        `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': client.userAgent,
            'X-YouTube-Client-Name': client.name === 'ANDROID' ? '3' : client.name === 'TV_EMBEDDED' ? '85' : '1',
            'X-YouTube-Client-Version': client.context.client.clientVersion,
          },
          body: JSON.stringify({
            videoId,
            context: client.context,
            contentCheckOk: true,
            racyCheckOk: true,
          }),
        }
      );

      const data = await playerResponse.json();
      const captionTracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

      if (!captionTracks || captionTracks.length === 0) continue;

      // Prefer English manual > English auto > first available
      let track =
        captionTracks.find(t => t.languageCode === 'en' && !t.kind) ||
        captionTracks.find(t => t.languageCode === 'en') ||
        captionTracks[0];

      const captionUrl = track.baseUrl + '&fmt=srv3';
      const captionRes = await fetch(captionUrl, {
        headers: { 'User-Agent': client.userAgent },
      });
      const captionXml = await captionRes.text();

      // Parse segments
      const segments = [];
      const segRegex = /<text[^>]*start="([^"]*)"[^>]*dur="([^"]*)"[^>]*>([\s\S]*?)<\/text>/g;
      let m;
      while ((m = segRegex.exec(captionXml)) !== null) {
        const startSec = parseFloat(m[1]);
        const text = m[3]
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\n/g, ' ')
          .trim();
        if (text) {
          const mins = Math.floor(startSec / 60);
          const secs = Math.floor(startSec % 60);
          segments.push({
            start: startSec,
            timestamp: `${mins}:${secs.toString().padStart(2, '0')}`,
            text,
          });
        }
      }

      if (segments.length === 0) continue;

      return {
        ok: true,
        videoId,
        language: track.languageCode,
        isAutoGenerated: track.kind === 'asr',
        segmentCount: segments.length,
        transcript: segments.map(s => s.text).join(' '),
        timestamped: segments.map(s => `[${s.timestamp}] ${s.text}`).join('\n'),
        clientUsed: client.name,
      };
    } catch (err) {
      console.warn(`[auto-capture] ${client.name} failed for ${videoId}:`, err.message);
      continue;
    }
  }
  return { ok: false, videoId, error: 'All transcript strategies failed' };
}

async function summarizeTranscript(transcript, title) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: 'ANTHROPIC_API_KEY not configured' };

  // Truncate if too long
  const maxChars = 80000;
  const trimmed = transcript.length > maxChars
    ? transcript.substring(0, maxChars) + '\n\n[Transcript truncated for analysis]'
    : transcript;

  const systemPrompt = `You are a medical education AI assistant helping physicians and medical students extract high-yield learning points from lectures.

Given a lecture transcript, produce a structured JSON analysis with these fields:
- "summary": 2-3 paragraph overview of the lecture content and key takeaways
- "keyPoints": array of 5-10 key learning points (strings)
- "clinicalPearls": array of 3-7 practical clinical insights (strings)
- "terminology": array of objects with "term" and "definition" fields (5-10 terms)
- "examQuestions": array of objects with "question" and "answer" fields (3-5 USMLE-style questions)

Return ONLY valid JSON, no markdown fencing or extra text.`;

  const userPrompt = title
    ? `Lecture: "${title}"\n\nTranscript:\n${trimmed}`
    : `Transcript:\n${trimmed}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    const data = await response.json();
    const text = data?.content?.[0]?.text;
    if (!text) return { ok: false, error: 'Empty AI response' };

    try {
      const analysis = JSON.parse(text);
      return { ok: true, analysis };
    } catch {
      return { ok: true, analysis: { summary: text, raw: true } };
    }
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Channel RSS feed check
// ---------------------------------------------------------------------------

function extractAllEntries(xml) {
  const entries = [];
  const re = /<entry>([\s\S]*?)<\/entry>/gi;
  let m;
  while ((m = re.exec(xml)) !== null) entries.push(m[1]);
  return entries;
}

function extractTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

function extractAttr(xml, tag, attr) {
  const re = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, 'i');
  const m = xml.match(re);
  return m ? m[1] : null;
}

async function checkChannel(channelId, sinceDate) {
  const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;
  const res = await fetch(feedUrl, {
    headers: {
      'User-Agent': 'MSIB.io/1.0 (Educational Platform; +https://msib.io)',
      'Accept': 'application/atom+xml, application/xml, text/xml',
    },
  });
  if (!res.ok) throw new Error(`Feed returned ${res.status}`);

  const xml = await res.text();
  const entries = extractAllEntries(xml).map(e => ({
    videoId: extractTag(e, 'yt:videoId'),
    title: extractTag(e, 'title'),
    published: extractTag(e, 'published'),
    url: extractAttr(e, 'link', 'href'),
    description: (extractTag(e, 'media:description') || '').substring(0, 500),
    thumbnail: extractAttr(e, 'media:thumbnail', 'url'),
  }));

  return entries.filter(v => new Date(v.published) > sinceDate);
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'POST only' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ ok: false, error: 'Invalid JSON' });
  }

  const {
    channelId,
    channelName = 'Unknown Channel',
    targetCourse = 'general',
    since,
    processedIds = [],
    autoAnalyze = true,
    dryRun = false,
  } = body;

  if (!channelId) {
    return res.status(400).json({ ok: false, error: 'Missing channelId' });
  }

  // Default: look back 7 days for recurring weekly series
  const sinceDate = since ? new Date(since) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const processedSet = new Set(processedIds);

  const result = {
    ok: true,
    channelId,
    channelName,
    targetCourse,
    checkedAt: new Date().toISOString(),
    sinceCutoff: sinceDate.toISOString(),
    captured: [],
    skipped: [],
    errors: [],
  };

  try {
    // Step 1: Check for new videos
    const newVideos = await checkChannel(channelId, sinceDate);

    if (newVideos.length === 0) {
      result.message = 'No new videos found since cutoff date';
      return res.status(200).json(result);
    }

    for (const video of newVideos) {
      // Skip already-processed videos
      if (processedSet.has(video.videoId)) {
        result.skipped.push({
          videoId: video.videoId,
          title: video.title,
          reason: 'Already processed',
        });
        continue;
      }

      if (dryRun) {
        result.captured.push({
          videoId: video.videoId,
          title: video.title,
          published: video.published,
          url: video.url,
          dryRun: true,
          message: 'Would capture this video (dry run mode)',
        });
        continue;
      }

      // Step 2: Fetch transcript
      const transcriptResult = await fetchTranscript(video.videoId);

      if (!transcriptResult.ok) {
        result.errors.push({
          videoId: video.videoId,
          title: video.title,
          phase: 'transcript',
          error: transcriptResult.error,
        });
        continue;
      }

      const capturedEntry = {
        videoId: video.videoId,
        title: video.title,
        published: video.published,
        url: video.url,
        thumbnail: video.thumbnail,
        targetCourse,
        label: video.title,
        transcriptLength: transcriptResult.transcript.length,
        segmentCount: transcriptResult.segmentCount,
        language: transcriptResult.language,
        isAutoGenerated: transcriptResult.isAutoGenerated,
        transcript: transcriptResult.transcript,
        timestamped: transcriptResult.timestamped,
        capturedAt: new Date().toISOString(),
      };

      // Step 3: AI analysis (if enabled)
      if (autoAnalyze) {
        const analysisResult = await summarizeTranscript(
          transcriptResult.transcript,
          video.title
        );

        if (analysisResult.ok) {
          capturedEntry.analysis = analysisResult.analysis;
          capturedEntry.analyzedAt = new Date().toISOString();
        } else {
          capturedEntry.analysisError = analysisResult.error;
        }
      }

      result.captured.push(capturedEntry);
    }

    result.summary = {
      newVideosFound: newVideos.length,
      captured: result.captured.length,
      skipped: result.skipped.length,
      errors: result.errors.length,
    };

    return res.status(200).json(result);
  } catch (err) {
    console.error('[auto-capture] Fatal error:', err);
    return res.status(500).json({
      ok: false,
      error: 'Auto-capture pipeline failed',
      detail: err.message,
    });
  }
}
