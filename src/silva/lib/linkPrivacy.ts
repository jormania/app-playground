/**
 * Which links Silva will ask the relay about, and which it will not.
 *
 * A preview is fetched server-side: the URL goes to `/api/notion-photo-proxy`,
 * which fetches the page and reads its Open Graph tags. For a public article
 * that is unremarkable. For everything else it is a leak with no warning
 * attached — and the Nursery fetches a preview the moment a share lands,
 * before you have decided whether to keep the thing at all. Release it a
 * second later and the URL has still left the device.
 *
 * Most of what that catches is not secret, only private: a link to a page on
 * a home server, a document handed to you by a one-time signed URL, a
 * password reset still sitting in a tab. None of those have a social image
 * worth having, and all of them are exactly the kind of thing a private
 * commonplace book ends up holding.
 *
 * So the rule is narrow and one-directional: a link that *looks like* it
 * carries a credential, or that points somewhere only this device can reach,
 * is never sent anywhere. It still gets kept, still gets its `Link` kind,
 * still opens on tap — it simply renders as the plain host/path line the
 * card falls back to whenever a preview is missing, which is a state the UI
 * already handles everywhere.
 */

/** Query or fragment names that mean "this URL is a key". */
const SECRET_PARAM =
  /(^|[_-])(token|access[_-]?token|id[_-]?token|refresh[_-]?token|auth|authorization|api[_-]?key|apikey|key|secret|password|passwd|pwd|signature|sig|session|sid|otp|code|credential|credentials)([_-]|$)/i

/** Hosts only this machine or this network can resolve. */
const PRIVATE_HOST =
  /^(localhost|[^.]+|.*\.(local|internal|lan|home|localhost)|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+|\[::1\]|\[fd[0-9a-f]{2}:.*\])$/i

/**
 * True when this URL may be sent to the preview relay.
 *
 * Deliberately conservative in one direction only: a false negative costs a
 * preview card, which is cosmetic and already optional. A false positive
 * costs a URL you never meant to hand to a server, which is not recoverable.
 */
export function mayFetchPreview(url: string | null | undefined): boolean {
  if (!url) return false

  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    return false
  }

  // Nothing but the web. A `file:`, `data:` or app-scheme URL has no page to
  // read, and its contents are nobody else's business either.
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
  // `https://user:password@host/…` — the credential is in the URL itself.
  if (parsed.username || parsed.password) return false
  // A host with no dot in it is a machine on this network, not a website.
  if (PRIVATE_HOST.test(parsed.host.replace(/:\d+$/, ''))) return false

  for (const key of parsed.searchParams.keys()) {
    if (SECRET_PARAM.test(key)) return false
  }
  // Single-page apps keep their whole route — tokens included — after the #.
  if (parsed.hash.length > 1) {
    const fragment = parsed.hash.slice(1)
    for (const key of new URLSearchParams(fragment.includes('=') ? fragment : '').keys()) {
      if (SECRET_PARAM.test(key)) return false
    }
  }

  return true
}
