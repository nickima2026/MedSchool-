// =============================================================================
// MSIB.io — YouTube Transcript API
// File: api/transcript.js
//
// Fetches captions/subtitles for a YouTube video by extracting the captions
// track URL from the video page's player config, then parsing the XML captions
// into plain text. No API key required — uses publicly available caption data.
//
// Usage: GET /api/transcript?v=VIDEO_ID
// Returns: { ok: true, videoId, transcript, segments: [{start, duration, text}] }
// =============================================================================

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=3600', // cache 1 hour
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const videoId = url.searchParams.get('v');

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return new Response(JSON.stringify({
      ok: false,
      error: 'Missing or invalid video ID. Use ?v=VIDEO_ID (11 characters).'
    }), { status: 400, headers: corsHeaders });
  }

  try {
    // Step 1: Fetch the YouTube video page
    const pageResp = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!pageResp.ok) {
      throw new Error(`YouTube returned ${pageResp.status}`);
    }

    const pageHtml = await pageResp.text();

    // Step 2: Extract captions player config from the page
    // Look for the captionTracks in the ytInitialPlayerResponse
    const captionMatch = pageHtml.match(/"captionTracks"\s*:\s*(\[.*?\])/);
    if (!captionMatch) {
      // Try alternative: sometimes captions are in a different format
      const altMatch = pageHtml.match(/"captions"\s*:\s*\{.*?"playerCaptionsTracklistRenderer"\s*:\s*\{.*?"captionTracks"\s*:\s*(\[.*?\])/s);
      if (!altMatch) {
        return new Response(JSON.stringify({
          ok: false,
          error: 'No captions available for this video. The video may not have subtitles enabled.',
          videoId,
          hint: 'Try clicking "..." below the video on YouTube → "Show transcript" to check if captions exist.'
        }), { status: 404, headers: corsHeaders });
      }
      var captionTracksJson = altMatch[1];
    } else {
      var captionTracksJson = captionMatch[1];
    }

    // Parse the caption tracks JSON
    let captionTracks;
    try {
      captionTracks = JSON.parse(captionTracksJson);
    } catch (e) {
      // The JSON might be truncated by the regex; try to fix common issues
      const fixed = captionTracksJson.replace(/,\s*$/, '') + ']';
      try {
        captionTracks = JSON.parse(fixed);
      } catch (e2) {
        throw new Error('Failed to parse caption tracks from page');
      }
    }

    if (!captionTracks || captionTracks.length === 0) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'No caption tracks found for this video.',
        videoId
      }), { status: 404, headers: corsHeaders });
    }

    // Step 3: Find the best caption track (prefer English, then auto-generated English, then first available)
    let track = captionTracks.find(t => t.languageCode === 'en' && !t.kind);
    if (!track) track = captionTracks.find(t => t.languageCode === 'en');
    if (!track) track = captionTracks.find(t => t.languageCode?.startsWith('en'));
    if (!track) track = captionTracks[0]; // fallback to first available

    const captionUrl = track.baseUrl;
    if (!captionUrl) {
      throw new Error('Caption track has no URL');
    }

    // Step 4: Fetch the caption XML
    const captionResp = await fetch(captionUrl);
    if (!captionResp.ok) {
      throw new Error(`Caption fetch returned ${captionResp.status}`);
    }

    const captionXml = await captionResp.text();

    // Step 5: Parse the XML into segments
    // YouTube caption XML format: <text start="0.0" dur="2.5">Caption text</text>
    const segments = [];
    const textRegex = /<text\s+start="([^"]+)"\s+dur="([^"]+)"[^>]*>([\s\S]*?)<\/text>/g;
    let match;

    while ((match = textRegex.exec(captionXml)) !== null) {
      const start = parseFloat(match[1]);
      const duration = parseFloat(match[2]);
      // Decode HTML entities in the caption text
      let text = match[3]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/<[^>]+>/g, '') // strip any HTML tags
        .replace(/\n/g, ' ')
        .trim();

      if (text) {
        segments.push({ start, duration, text });
      }
    }

    if (segments.length === 0) {
      throw new Error('Parsed 0 caption segments from XML');
    }

    // Step 6: Build full transcript text
    const transcript = segments.map(s => s.text).join(' ');

    // Also build a timestamped version
    const timestamped = segments.map(s => {
      const mins = Math.floor(s.start / 60);
      const secs = Math.floor(s.start % 60);
      const ts = `${mins}:${secs.toString().padStart(2, '0')}`;
      return `[${ts}] ${s.text}`;
    }).join('\n');

    return new Response(JSON.stringify({
      ok: true,
      videoId,
      language: track.languageCode || 'unknown',
      isAutoGenerated: track.kind === 'asr',
      segmentCount: segments.length,
      transcript,
      timestamped,
      segments
    }), { status: 200, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({
      ok: false,
      error: err.message || 'Failed to fetch transcript',
      videoId,
      hint: 'This video may not have captions, or YouTube may be blocking the request. Try the manual copy method instead.'
    }), { status: 500, headers: corsHeaders });
  }
}
