// =============================================================================
// MSIB.io — YouTube Transcript API
// File: api/transcript.js
//
// Fetches captions for a YouTube video using multiple innertube client
// strategies to bypass bot detection on cloud IPs.
//
// Strategy order:
//   1. ANDROID client  — least likely to trigger bot detection
//   2. WEB_EMBEDDED_PLAYER — embedded player context, often unblocked
//   3. WEB client — original approach, fallback
//
// Usage: GET /api/transcript?v=VIDEO_ID
// Returns: { ok, videoId, transcript, timestamped, segments[] }
// =============================================================================

export const config = { runtime: 'nodejs', maxDuration: 30 };

const INNERTUBE_API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

// Multiple client configs — tried in order until one works
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
      thirdParty: {
        embedUrl: 'https://www.google.com',
      },
    },
    userAgent: 'Mozilla/5.0 (SMART-TV; Linux; Tizen 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Version/5.0 TV Safari/537.36',
  },
  {
    name: 'WEB',
    context: {
      client: {
        clientName: 'WEB',
        clientVersion: '2.20241001.00.00',
        hl: 'en',
        gl: 'US',
      },
    },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
];

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

  const errors = [];

  // Try each client strategy in order
  for (const client of CLIENTS) {
    try {
      console.log(`[transcript] Trying ${client.name} client for ${videoId}`);
      const result = await tryClient(client, videoId);
      if (result.ok) {
        console.log(`[transcript] Success with ${client.name}: ${result.segmentCount} segments`);
        return res.status(200).json(result);
      } else {
        console.log(`[transcript] ${client.name} failed: ${result.error}`);
        errors.push(`${client.name}: ${result.error}`);
      }
    } catch (err) {
      console.log(`[transcript] ${client.name} threw: ${err.message}`);
      errors.push(`${client.name}: ${err.message}`);
    }
  }

  // All strategies failed — try the watch page scrape as last resort
  try {
    console.log(`[transcript] Trying watch page scrape for ${videoId}`);
    const result = await tryWatchPageScrape(videoId);
    if (result.ok) {
      console.log(`[transcript] Watch page scrape succeeded: ${result.segmentCount} segments`);
      return res.status(200).json(result);
    } else {
      errors.push(`WatchPage: ${result.error}`);
    }
  } catch (err) {
    errors.push(`WatchPage: ${err.message}`);
  }

  // Everything failed
  console.error('[transcript] All strategies failed:', errors);
  return res.status(500).json({
    ok: false,
    error: 'Could not fetch transcript. YouTube may be blocking server requests.',
    details: errors,
    videoId,
    hint: 'Use the "Paste Transcript" button — on YouTube, click "..." below the video → "Show transcript", select all text, and paste it here.',
  });
}

// ---------------------------------------------------------------------------
// Strategy: innertube player API with a specific client config
// ---------------------------------------------------------------------------
async function tryClient(client, videoId) {
  const playerResp = await fetch(
    `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_API_KEY}&prettyPrint=false`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': client.userAgent,
        'X-YouTube-Client-Name': clientNameToId(client.context.client.clientName),
        'X-YouTube-Client-Version': client.context.client.clientVersion,
      },
      body: JSON.stringify({
        context: client.context,
        videoId,
      }),
    }
  );

  if (!playerResp.ok) {
    return { ok: false, error: `HTTP ${playerResp.status}` };
  }

  const data = await playerResp.json();

  // Check playability
  if (data.playabilityStatus?.status !== 'OK') {
    const reason = data.playabilityStatus?.reason || data.playabilityStatus?.status || 'Unknown';
    return { ok: false, error: reason };
  }

  // Extract caption tracks
  const tracks = data.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!tracks || tracks.length === 0) {
    return { ok: false, error: 'No caption tracks found' };
  }

  // Find best track (prefer English manual → English auto → first)
  let track = tracks.find(t => t.languageCode === 'en' && t.kind !== 'asr');
  if (!track) track = tracks.find(t => t.languageCode === 'en');
  if (!track) track = tracks.find(t => t.languageCode?.startsWith('en'));
  if (!track) track = tracks[0];

  if (!track.baseUrl) {
    return { ok: false, error: 'Caption track has no URL' };
  }

  // Fetch and parse the caption XML
  return await fetchAndParseCaptions(track, videoId);
}

// ---------------------------------------------------------------------------
// Strategy: scrape the watch page for ytInitialPlayerResponse
// ---------------------------------------------------------------------------
async function tryWatchPageScrape(videoId) {
  const resp = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml',
    },
  });

  if (!resp.ok) {
    return { ok: false, error: `Watch page HTTP ${resp.status}` };
  }

  const html = await resp.text();

  // Extract ytInitialPlayerResponse from page source
  const match = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
  if (!match) {
    return { ok: false, error: 'Could not find player response in page' };
  }

  let data;
  try {
    data = JSON.parse(match[1]);
  } catch {
    return { ok: false, error: 'Failed to parse player response JSON' };
  }

  if (data.playabilityStatus?.status !== 'OK') {
    return { ok: false, error: data.playabilityStatus?.reason || 'Not playable' };
  }

  const tracks = data.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!tracks || tracks.length === 0) {
    return { ok: false, error: 'No captions in watch page data' };
  }

  let track = tracks.find(t => t.languageCode === 'en' && t.kind !== 'asr');
  if (!track) track = tracks.find(t => t.languageCode === 'en');
  if (!track) track = tracks.find(t => t.languageCode?.startsWith('en'));
  if (!track) track = tracks[0];

  if (!track.baseUrl) {
    return { ok: false, error: 'Caption track has no URL' };
  }

  return await fetchAndParseCaptions(track, videoId);
}

// ---------------------------------------------------------------------------
// Shared: fetch caption XML and parse into segments
// ---------------------------------------------------------------------------
async function fetchAndParseCaptions(track, videoId) {
  const captionUrl = track.baseUrl;

  // Try srv3 format first, then plain
  for (const fmt of ['srv3', null]) {
    const url = fmt
      ? (captionUrl.includes('?') ? `${captionUrl}&fmt=${fmt}` : `${captionUrl}?fmt=${fmt}`)
      : captionUrl;

    try {
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });

      if (!resp.ok) continue;

      const xml = await resp.text();
      const segments = parseXml(xml);

      if (segments.length > 0) {
        const transcript = segments.map(s => s.text).join(' ');
        const timestamped = segments.map(s => {
          const mins = Math.floor(s.start / 60);
          const secs = Math.floor(s.start % 60);
          return `[${mins}:${secs.toString().padStart(2, '0')}] ${s.text}`;
        }).join('\n');

        return {
          ok: true,
          videoId,
          language: track.languageCode || 'unknown',
          languageName: track.name?.simpleText || track.languageCode || 'unknown',
          isAutoGenerated: track.kind === 'asr',
          segmentCount: segments.length,
          transcript,
          timestamped,
          segments,
        };
      }
    } catch {
      continue;
    }
  }

  return { ok: false, error: 'Could not parse caption XML' };
}

// ---------------------------------------------------------------------------
// Parse caption XML (srv3 + timedtext formats)
// ---------------------------------------------------------------------------
function parseXml(xml) {
  const segments = [];

  // srv3: <p t="start_ms" d="dur_ms">text</p>
  const srv3 = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  let m;
  while ((m = srv3.exec(xml)) !== null) {
    const text = decode(m[3]).trim();
    if (text) {
      segments.push({
        start: parseInt(m[1], 10) / 1000,
        duration: parseInt(m[2], 10) / 1000,
        text,
      });
    }
  }

  if (segments.length > 0) return segments;

  // timedtext: <text start="s" dur="s">text</text>
  const tt = /<text\s+start="([^"]+)"\s+dur="([^"]+)"[^>]*>([\s\S]*?)<\/text>/g;
  while ((m = tt.exec(xml)) !== null) {
    const text = decode(m[3]).trim();
    if (text) {
      segments.push({
        start: parseFloat(m[1]),
        duration: parseFloat(m[2]),
        text,
      });
    }
  }

  return segments;
}

// ---------------------------------------------------------------------------
// Decode HTML entities and strip tags
// ---------------------------------------------------------------------------
function decode(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/<[^>]+>/g, '')
    .replace(/\n/g, ' ');
}

// ---------------------------------------------------------------------------
// Map client name to numeric ID for X-YouTube-Client-Name header
// ---------------------------------------------------------------------------
function clientNameToId(name) {
  const map = {
    WEB: '1',
    ANDROID: '3',
    IOS: '5',
    TVHTML5_SIMPLY_EMBEDDED_PLAYER: '85',
  };
  return map[name] || '1';
}
