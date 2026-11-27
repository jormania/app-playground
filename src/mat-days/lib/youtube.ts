/**
 * Everything Mat Days knows about YouTube URLs. Pure functions, no network.
 *
 * Playback strategy (MAT_DAYS.md, "Opening the YouTube app"):
 * 1. The canonical link is always https://www.youtube.com/watch?v=ID. On Android
 *    and iOS that URL is an App Link / Universal Link the YouTube app claims, so
 *    a user tap on it hands off to the app when the OS allows.
 * 2. An installed PWA opens other-origin links in a Custom Tab, where hand-off is
 *    less dependable. On Android we therefore offer an `intent://` URL, with the
 *    https URL as `browser_fallback_url`. By default it names no package, so it
 *    opens whichever app you've set to handle YouTube links (a patched client such
 *    as Morphe or ReVanced included); "Official YouTube app" names Google's. If the app
 *    is missing or disabled, Chrome opens the browser URL instead. This is not a
 *    custom `youtube://` scheme; it is Chrome's documented intent syntax.
 * 3. A plain browser link and an embedded player are always available too.
 */

const ID_RE = /^[A-Za-z0-9_-]{11}$/
const YT_HOSTS = new Set([
  'youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com',
  'youtube-nocookie.com', 'www.youtube-nocookie.com',
])

export const YOUTUBE_APP_PACKAGE = 'com.google.android.youtube'

export function isVideoId(value: string): boolean {
  return ID_RE.test(value)
}

/** Extracts the 11-character video id from any common YouTube URL form, or a bare id. */
export function parseVideoId(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null
  if (isVideoId(raw)) return raw
  let url: URL
  try {
    url = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`)
  } catch {
    return null
  }
  const host = url.hostname.toLowerCase()
  let candidate: string | null = null
  if (host === 'youtu.be') {
    candidate = url.pathname.split('/')[1] ?? null
  } else if (YT_HOSTS.has(host)) {
    if (url.pathname === '/watch') candidate = url.searchParams.get('v')
    else {
      const m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/)
      candidate = m ? m[1] : null
    }
  }
  return candidate && isVideoId(candidate) ? candidate : null
}

export function canonicalUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`
}

export function searchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
}

/** hqdefault exists for every public video; maxres does not, so it is not used. */
export function thumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
}

export function embedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`
}

/**
 * Chrome-on-Android intent URL that opens `httpsUrl` in an app, and `httpsUrl`
 * itself in the browser when no app can take it. Without `pkg`, Android picks
 * the app you've chosen for YouTube links; with it, only that app.
 */
export function androidIntentUrl(httpsUrl: string, pkg?: string): string {
  const u = new URL(httpsUrl)
  const path = `${u.host}${u.pathname}${u.search}`
  const target = pkg ? `package=${pkg};` : 'category=android.intent.category.BROWSABLE;'
  return `intent://${path}#Intent;scheme=https;${target}S.browser_fallback_url=${encodeURIComponent(httpsUrl)};end`
}

export type Platform = 'android' | 'ios' | 'desktop'

export function detectPlatform(userAgent: string, maxTouchPoints = 0): Platform {
  if (/Android/i.test(userAgent)) return 'android'
  // iPadOS 13+ reports itself as Macintosh; touch points give it away.
  if (/iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)) return 'ios'
  return 'desktop'
}

/** The href Start Practice uses for this platform and preference. */
const PACKAGE_RE = /^[a-zA-Z][\w]*(\.[a-zA-Z][\w]*)+$/

export function isPackageName(value: string): boolean {
  return PACKAGE_RE.test(value.trim())
}

export function practiceHref(httpsUrl: string, platform: Platform, method: 'auto' | 'youtube' | 'custom' | 'link', pkg?: string): string {
  if (platform !== 'android' || method === 'link') return httpsUrl
  if (method === 'youtube') return androidIntentUrl(httpsUrl, YOUTUBE_APP_PACKAGE)
  if (method === 'custom' && pkg && isPackageName(pkg)) return androidIntentUrl(httpsUrl, pkg.trim())
  return androidIntentUrl(httpsUrl)
}
