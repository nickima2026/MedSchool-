// =============================================================================
// MSIB.io — YouTube Channel Monitor API
// File: api/channel-monitor.js
//
// Checks a YouTube channel's public RSS feed for new video uploads.
// Designed to be called by scheduled tasks or manual triggers to detect
// new lectures in recurring series (e.g., Grand Rounds).
//
// YouTube provides a public Atom feed for every channel at:
//   https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID
//
// Usage: GET /api/channel-monitor?channelId=CHANNEL_ID&since=ISO_DATE
// Returns: { ok, channelId, newVideos[], checkedAt }
//
// Optional params:
//   since    — ISO date string; only return videos published after this date
//              Defaults to 48 hours ago
//   limit    — max videos to return (default 5)
// =============================================================================

export const config = { runtime: 'nodejs', maxDuration: 15 };

// Simple XML tag extractor — no dependency needed for Atom feeds
function extractTag(xml, tag) {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

function extractAttribute(xml, tag, attr) {
  const regex = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, 'i');
  const match = xml.match(regex);
  return match ? match[1] : null;
}

function extractAllEntries(xml) {
  const entries = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
  let match;
  while ((match = entryRegex.exec(xml)) !== null) {
    entries.push(match[1]);
  }
  return entries;
}

function parseEntry(entryXml) {
  const videoId = extractTag(entryXml, 'yt:videoId');
  const title = extractTag(entryXml, 'title');
  const published = extractTag(entryXml, 'published');
  const updated = extractTag(entryXml, 'updated');
  const link = extractAttribute(entryXml, 'link', 'href');

  // Extract media:group details
  const description = extractTag(entryXml, 'media:description') || '';
  const thumbnail = extractAttribute(entryXml, 'media:thumbnail', 'url');

  return {
    videoId,
    title,
    published,
    updated,
    url: link || `https://www.youtube.com/watch?v=${videoId}`,
    thumbnail,
    description: description.substring(0, 500), // truncate long descriptions
  };
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const { channelId, since, limit = '5' } = req.query;

  if (!channelId) {
    return res.status(400).json({
      ok: false,
      error: 'Missing required parameter: channelId',
      hint: 'Find channel ID from the YouTube channel URL or page source',
    });
  }

  // Default: look back 48 hours
  const sinceDate = since
    ? new Date(since)
    : new Date(Date.now() - 48 * 60 * 60 * 1000);

  if (isNaN(sinceDate.getTime())) {
    return res.status(400).json({
      ok: false,
      error: 'Invalid "since" date. Use ISO 8601 format (e.g., 2026-04-10T00:00:00Z)',
    });
  }

  const maxResults = Math.min(parseInt(limit, 10) || 5, 25);

  try {
    // Fetch the channel's public RSS/Atom feed
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`;

    const feedResponse = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'MSIB.io/1.0 (Educational Platform; +https://msib.io)',
        'Accept': 'application/atom+xml, application/xml, text/xml',
      },
    });

    if (!feedResponse.ok) {
      if (feedResponse.status === 404) {
        return res.status(404).json({
          ok: false,
          error: 'Channel not found. Verify the channel ID.',
          channelId,
        });
      }
      throw new Error(`YouTube feed returned ${feedResponse.status}`);
    }

    const feedXml = await feedResponse.text();

    // Parse channel info
    const channelTitle = extractTag(feedXml, 'title');

    // Parse all entries (videos)
    const entryXmls = extractAllEntries(feedXml);
    const allVideos = entryXmls.map(parseEntry);

    // Filter to videos published after the since date
    const newVideos = allVideos
      .filter(v => {
        const pubDate = new Date(v.published);
        return pubDate > sinceDate;
      })
      .slice(0, maxResults);

    return res.status(200).json({
      ok: true,
      channelId,
      channelTitle,
      checkedAt: new Date().toISOString(),
      sinceCutoff: sinceDate.toISOString(),
      totalInFeed: allVideos.length,
      newCount: newVideos.length,
      newVideos,
      // Include the most recent video regardless, for verification
      mostRecent: allVideos.length > 0 ? allVideos[0] : null,
    });
  } catch (err) {
    console.error('Channel monitor error:', err);
    return res.status(500).json({
      ok: false,
      error: 'Failed to check channel feed',
      detail: err.message,
    });
  }
}
