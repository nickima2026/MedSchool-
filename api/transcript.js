// =============================================================================
// MSIB.io — YouTube Transcript API
// File: api/transcript.js
//
// Fetches captions for a YouTube video using YouTube's innertube player API
// to get caption track URLs, then fetches and parses the XML captions.
// No API key required — uses YouTube's public innertube endpoints.
//
// Usage: GET /api/transcript?v=VIDEO_ID
// Returns: { ok, videoId, transcript, timestamped, segments[] }
// =============================================================================

// Use Node.js runtime (not edge) for better fetch compatibility
export const config = { runtime: 'nodejs', maxDuration: 15 };

const INNERTUBE_API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const INNERTUBE_CLIENT = {
  clientName: 'WEB',
  clientVersion: '2.20241001.00.00',
  hl: 'en',
  gl: 'US',
};

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'public, max-age=3600');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const videoId = req.query.v;
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return res.status(400).json({
      ok: false,
      error: 'Missing or invalid video ID. Use ?v=VIDEO_ID (11 characters).',
    });
  }

  try {
    // Step 1: Use innertube player API to get caption track URLs
    const playerResp = await fetch(
      `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_API_KEY}&prettyPrint=false`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        body: JSON.stringify({
          context: { client: INNERTUBE_CLIENT },
          videoId: videoId,
        }),
      }
    );

    if (!playerResp.ok) {
      throw new Error(`YouTube player API returned ${playerResp.status}`);
    }

    const playerData = await playerResp.json();

    // Check if the video exists and is playable
    if (playerData.playabilityStatus?.status !== 'OK') {
      const reason = playerData.playabilityStatus?.reason || 'Video unavailable';
      return res.status(404).json({
        ok: false,
        error: reason,
        videoId,
      });
    }

    // Step 2: Extract caption tracks
    const captionTracks =
      playerData.captions?.playerCaptionsTracklistRenderer?.captionTracks;

    if (!captionTracks || captionTracks.length === 0) {
      return res.status(404).json({
        ok: false,
        error: 'No captions available for this video. The video may not have subtitles enabled.',
        videoId,
        hint: 'On YouTube, click "..." below the video → "Show transcript" to verify captions exist.',
      });
    }

    // Step 3: Find the best caption track (prefer English manual, then English auto, then first)
    let track = captionTracks.find(
      (t) => t.languageCode === 'en' && t.kind !== 'asr'
    );
    if (!track) track = captionTracks.find((t) => t.languageCode === 'en');
    if (!track)
      track = captionTracks.find((t) => t.languageCode?.startsWith('en'));
    if (!track) track = captionTracks[0];

    const captionUrl = track.baseUrl;
    if (!captionUrl) {
      throw new Error('Caption track found but has no URL');
    }

    // Step 4: Fetch the caption XML (append fmt=srv3 for XML format)
    const xmlUrl = captionUrl.includes('?')
      ? `${captionUrl}&fmt=srv3`
      : `${captionUrl}?fmt=srv3`;

    const captionResp = await fetch(xmlUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    });

    if (!captionResp.ok) {
      // Try without fmt parameter
      const fallbackResp = await fetch(captionUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });
      if (!fallbackResp.ok) {
        throw new Error(`Caption XML fetch failed: ${fallbackResp.status}`);
      }
      var captionXml = await fallbackResp.text();
    } else {
      var captionXml = await captionResp.text();
    }

    // Step 5: Parse XML into segments
    const segments = [];

    // Try srv3 format first: <p t="start_ms" d="duration_ms">text</p>
    const srv3Regex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
    let match;
    while ((match = srv3Regex.exec(captionXml)) !== null) {
      const startMs = parseInt(match[1], 10);
      const durationMs = parseInt(match[2], 10);
      let text = decodeEntities(match[3]);
      if (text.trim()) {
        segments.push({
          start: startMs / 1000,
          duration: durationMs / 1000,
          text: text.trim(),
        });
      }
    }

    // If srv3 didn't work, try standard timedtext format: <text start="s" dur="s">text</text>
    if (segments.length === 0) {
      const textRegex =
        /<text\s+start="([^"]+)"\s+dur="([^"]+)"[^>]*>([\s\S]*?)<\/text>/g;
      while ((match = textRegex.exec(captionXml)) !== null) {
        const start = parseFloat(match[1]);
        const duration = parseFloat(match[2]);
        let text = decodeEntities(match[3]);
        if (text.trim()) {
          segments.push({ start, duration, text: text.trim() });
        }
      }
    }

    if (segments.length === 0) {
      // Last resort: log what we got for debugging
      console.log('Caption XML sample:', captionXml.substring(0, 500));
      throw new Error(
        'Could not parse caption segments. The caption format may have changed.'
      );
    }

    // Step 6: Build output
    const transcript = segments.map((s) => s.text).join(' ');
    const timestamped = segments
      .map((s) => {
        const mins = Math.floor(s.start / 60);
        const secs = Math.floor(s.start % 60);
        return `[${mins}:${secs.toString().padStart(2, '0')}] ${s.text}`;
      })
      .join('\n');

    return res.status(200).json({
      ok: true,
      videoId,
      language: track.languageCode || 'unknown',
      languageName: track.name?.simpleText || track.languageCode || 'unknown',
      isAutoGenerated: track.kind === 'asr',
      segmentCount: segments.length,
      transcript,
      timestamped,
      segments,
    });
  } catch (err) {
    console.error('Transcript fetch error:', err.message);
    return res.status(500).json({
      ok: false,
      error: err.message || 'Failed to fetch transcript',
      videoId,
      hint: 'This video may not have captions, or YouTube may be blocking the request. Try the manual copy method.',
    });
  }
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/<[^>]+>/g, '') // strip HTML tags
    .replace(/\n/g, ' ');
}
