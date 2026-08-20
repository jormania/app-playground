// Pure parsing/validation logic for the link-preview branch of
// notion-photo-proxy.js, split out so it's testable without a real network
// call (same "handler stays a thin HTTP wrapper" split as the clickdeck
// _lib modules).

// A page fetched for its metadata is a genuinely arbitrary URL (whatever a
// reader pasted), unlike the signed Notion URLs the proxy's default mode
// relays — so this is the one place in the repo that fetches a hostname it
// doesn't already trust, and it's guarded accordingly.
const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /\.local$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\.0\.0\.0$/,
  /^\[?::1\]?$/,
  /^\[?f[cd][0-9a-f]{2}:/i, // IPv6 unique local (fc00::/7)
  /^\[?fe80:/i, // IPv6 link-local
]

export function isPrivateHost(hostname) {
  return PRIVATE_HOST_PATTERNS.some((re) => re.test(hostname))
}

export function emptyPreview(url) {
  return { title: null, description: null, image: null, siteName: url.hostname, url: url.href }
}

export function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
}

export function metaTags(html) {
  const tags = new Map()
  const tagRe = /<meta\s+[^>]*>/gi
  let match
  while ((match = tagRe.exec(html))) {
    const tag = match[0]
    const key = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]
    const content = /content\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1]
    if (key && content !== undefined && !tags.has(key.toLowerCase())) {
      tags.set(key.toLowerCase(), decodeEntities(content))
    }
  }
  return tags
}

export function parsePreview(html, pageUrl) {
  const tags = metaTags(html)
  const titleTag = /<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]

  const title = tags.get('og:title') || tags.get('twitter:title') || (titleTag ? decodeEntities(titleTag).trim() : null)
  const description = tags.get('og:description') || tags.get('twitter:description') || tags.get('description') || null
  const siteName = tags.get('og:site_name') || pageUrl.hostname

  let image = tags.get('og:image') || tags.get('og:image:url') || tags.get('twitter:image') || null
  if (image) {
    try {
      image = new URL(image, pageUrl).href
    } catch {
      image = null
    }
  }

  return { title: title || null, description: description || null, image, siteName, url: pageUrl.href }
}
