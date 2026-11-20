// Reading a YouTube channel's uploads for Stillflow's "Check for updates".
//
// Two ways, chosen by whether YOUTUBE_API_KEY is set on the deployment:
//
// - YouTube Data API v3 (free key, 10,000 units/day): the channel's uploads
//   playlist, 50 videos a page at 2 units a page. All ~750 Yoga With Adriene
//   videos come to about 32 units, with real durations.
// - Without a key, the channel's public RSS feed. It only ever holds the 15
//   newest uploads and carries no durations, so it can spot new videos but not
//   import the back catalogue.
//
// No scraping: both are documented, public interfaces. Pure functions here so
// the handler stays thin and everything is testable without the network.

export const CHANNEL_ID_RE = /^UC[A-Za-z0-9_-]{22}$/
const PAGE_TOKEN_RE = /^[A-Za-z0-9_-]{1,64}$/

/** The uploads playlist id is the channel id with UC swapped for UU. */
export function uploadsPlaylistId(channelId) {
  return `UU${channelId.slice(2)}`
}

/** ISO 8601 duration (PT1H2M3S, P1DT2H) → seconds; null when unreadable. */
export function isoDurationSeconds(iso) {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(String(iso || ''))
  if (!m || iso === 'P' || iso === 'PT') return null
  const [, d, h, min, s] = m.map((x) => Number(x || 0))
  return d * 86400 + h * 3600 + min * 60 + s
}

export function validPageToken(token) {
  return token == null || token === '' || PAGE_TOKEN_RE.test(token)
}

const UNAVAILABLE = new Set(['Private video', 'Deleted video'])

/** Merge a playlistItems page with the videos.list details for the same ids. */
export function mergeApiPage(playlistPage, videosPage) {
  const details = new Map((videosPage.items || []).map((v) => [v.id, v]))
  const videos = []
  for (const item of playlistPage.items || []) {
    const id = item.contentDetails?.videoId || item.snippet?.resourceId?.videoId
    const title = item.snippet?.title
    if (!id || !title || UNAVAILABLE.has(title)) continue
    const d = details.get(id)
    if (!d) continue // private, removed or region-blocked since listing
    if (d.snippet?.liveBroadcastContent && d.snippet.liveBroadcastContent !== 'none') continue // upcoming or live now
    videos.push({
      videoId: id,
      title: d.snippet?.title || title,
      description: String(d.snippet?.description || '').slice(0, 2000),
      publishedAt: d.contentDetails?.videoPublishedAt || item.contentDetails?.videoPublishedAt || d.snippet?.publishedAt || null,
      durationSeconds: isoDurationSeconds(d.contentDetails?.duration),
    })
  }
  return videos
}

const decodeXml = (s) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&amp;/g, '&')

const tag = (xml, name) => {
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`).exec(xml)
  return m ? decodeXml(m[1].trim()) : ''
}

/** The channel's Atom feed → videos without durations (the feed has none). */
export function parseChannelFeed(xml) {
  const out = []
  for (const m of String(xml).matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const entry = m[1]
    const videoId = tag(entry, 'yt:videoId')
    const title = tag(entry, 'title')
    if (!videoId || !title) continue
    out.push({
      videoId,
      title,
      description: tag(entry, 'media:description').slice(0, 2000),
      publishedAt: tag(entry, 'published') || null,
      durationSeconds: null,
    })
  }
  return out
}

/** One page of a channel's uploads. `fetchImpl` is injectable for tests. */
export async function readChannelPage({ channelId, pageToken, apiKey, fetchImpl = fetch }) {
  if (apiKey) {
    const base = 'https://www.googleapis.com/youtube/v3'
    const list = new URL(`${base}/playlistItems`)
    list.search = new URLSearchParams({
      part: 'snippet,contentDetails', maxResults: '50', playlistId: uploadsPlaylistId(channelId), key: apiKey,
      ...(pageToken ? { pageToken } : {}),
    }).toString()
    const page = await apiJson(fetchImpl, list)
    const ids = (page.items || []).map((i) => i.contentDetails?.videoId).filter(Boolean)
    let details = { items: [] }
    if (ids.length) {
      const v = new URL(`${base}/videos`)
      v.search = new URLSearchParams({ part: 'snippet,contentDetails', id: ids.join(','), key: apiKey, maxResults: '50' }).toString()
      details = await apiJson(fetchImpl, v)
    }
    return {
      source: 'api',
      videos: mergeApiPage(page, details),
      nextPageToken: page.nextPageToken || null,
      total: page.pageInfo?.totalResults ?? null,
    }
  }
  const res = await fetchImpl(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`)
  if (!res.ok) throw new HttpError(502, `YouTube's feed answered ${res.status}.`)
  return { source: 'rss', videos: parseChannelFeed(await res.text()), nextPageToken: null, total: null }
}

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

async function apiJson(fetchImpl, url) {
  const res = await fetchImpl(url.toString())
  const body = await res.json().catch(() => ({}))
  if (res.ok) return body
  const reason = body?.error?.errors?.[0]?.reason || ''
  if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
    throw new HttpError(429, 'The YouTube API quota for today is used up. It resets at midnight Pacific time.')
  }
  if (res.status === 400 || res.status === 403) {
    throw new HttpError(502, `YouTube refused the API key (${reason || res.status}). Check that the YouTube Data API v3 is enabled for it.`)
  }
  if (res.status === 404) throw new HttpError(404, 'YouTube has no such channel.')
  throw new HttpError(502, `YouTube answered ${res.status}.`)
}
