/**
 * Something shared into Silva from elsewhere on the device.
 *
 * SILVA.md lists four lanes into the understory and Silva shipped with two,
 * both of which require the same thing: deliberately opening the app and
 * typing. Everything encountered in a browser, a reader or a chat — which is
 * most of what anyone encounters — reached Silva only if you remembered, later,
 * to go and re-enter it. For an app that describes itself as phone-first, that
 * is the gap that matters.
 *
 * ── Why this is a URL parser and not a share handler ────────────────────
 * A Web Share Target declared with `method: "GET"` does not POST anything. The
 * OS simply *launches the app at a URL with query parameters*, which means the
 * entire mechanism is `location.search` — no endpoint to host, and so no cost
 * against the serverless budget, which sits at 12 of 12 and which Silva was
 * built to add nothing to.
 *
 * That has a second, larger consequence. Because the real feature is
 * URL-parameter intake rather than the share target itself, it is not
 * Android-only: iOS has no Web Share Target API, but an iOS Shortcut in the
 * share sheet can open `silva-react.html?text=…` and land in exactly this
 * code. One parser, both platforms, one day's work.
 */

/** What arrived, already shaped into Silva's own fields. */
export interface SharedIntake {
  /** Pre-fills the intake field — never written straight to a thing. */
  body: string
  /** Pre-fills the locator, when the share carried a source URL. */
  locator: string
}

/** Query keys, matching the `share_target.params` in silva.webmanifest. */
const TEXT = 'text'
const URL_PARAM = 'url'
const TITLE = 'title'

function looksLikeUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value.trim())
}

/**
 * Reads a share out of a query string, or returns null when there isn't one.
 *
 * Share sheets are inconsistent about which field carries what — several
 * Android apps put the URL in `text` and leave `url` empty, and some put the
 * page title in `text` alongside it. So this normalises rather than trusting
 * the split: whatever reads as prose becomes the body, and a URL becomes the
 * locator, wherever each one actually arrived.
 */
export function parseSharedIntake(search: string): SharedIntake | null {
  let params: URLSearchParams
  try {
    params = new URLSearchParams(search)
  } catch {
    return null
  }

  const text = (params.get(TEXT) || '').trim()
  const url = (params.get(URL_PARAM) || '').trim()
  const title = (params.get(TITLE) || '').trim()

  if (!text && !url && !title) return null

  // A share whose `text` is nothing but a URL is a link, not a passage — so it
  // becomes the locator and the title (if any) carries the meaning.
  const textIsBareUrl = Boolean(text) && looksLikeUrl(text)
  const locator = url || (textIsBareUrl ? text : '')

  const bodyParts: string[] = []
  if (text && !textIsBareUrl) bodyParts.push(text)
  // Only add the title when it isn't already the opening of the shared text —
  // sharing a selection from an article commonly sends both, duplicated.
  if (title && !bodyParts.some((part) => part.startsWith(title))) bodyParts.push(title)

  const body = bodyParts.join('\n\n').trim()

  // A bare link with no words at all is still worth keeping — the locator
  // carries it, and the body is left for you to say why.
  if (!body && !locator) return null

  return { body, locator }
}

/**
 * The URL to replace the current one with once a share has been taken in, so a
 * refresh doesn't re-add what you already captured. Keeps the path and hash,
 * drops the whole query — Silva has no other query parameters to preserve.
 */
export function urlWithoutShare(href: string): string {
  try {
    const url = new URL(href)
    url.search = ''
    return url.toString()
  } catch {
    return href
  }
}
