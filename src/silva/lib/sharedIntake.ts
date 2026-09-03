/**
 * Something shared into Silva from elsewhere on the device.
 *
 * SILVA.md listed four lanes into the understory and Silva had shipped two,
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

const URL_TOKEN = /^https?:\/\/\S+$/i

function looksLikeUrl(value: string): boolean {
  return URL_TOKEN.test(value.trim())
}

/**
 * A URL that arrived as its own word at one end of the shared text, split
 * off from the words around it — or null when there is nothing to split.
 *
 * Most Android apps do not fill the `url` parameter at all: they send one
 * `text` reading "Some video title\nhttps://youtu.be/x", or "worth a read:
 * https://…". Left whole, that is not a bare URL, so it earned no `link`, no
 * preview card and no `Link` kind — the share lane quietly lost the one
 * capture Silva knows most about.
 *
 * This is not the same judgment as a *locator* that merely contains a URL
 * ("overheard on the 32 tram, https://…"), which stays exactly where you put
 * it: those are words you typed, and these are a share sheet's boilerplate
 * wrapped around a link. So the split is deliberately narrow — the URL must
 * be a whole whitespace-delimited word at the very start or the very end,
 * and what remains must be prose rather than a second URL. Anything else is
 * left alone as the passage it might be.
 */
function splitEdgeUrl(text: string): { prose: string; url: string } | null {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length < 2) return null

  const last = words[words.length - 1]
  const first = words[0]
  const token = URL_TOKEN.test(last) ? last : URL_TOKEN.test(first) ? first : null
  if (!token) return null

  const cut = token === last ? text.lastIndexOf(token) : text.indexOf(token)
  const rest = token === last ? text.slice(0, cut) : text.slice(cut + token.length)
  // Two URLs and no words is a list of links, not a link with a note — and
  // whichever one we kept, we would be choosing for you.
  if (looksLikeUrl(rest)) return null

  return { prose: trimDanglingJoiner(rest), url: trimSentencePunctuation(token) }
}

/**
 * The URL without the punctuation the sentence around it left attached.
 *
 * "Read this https://x.dev/a." ends in a full stop belonging to the
 * sentence, not to the page — kept, it is a link that 404s, printed on a
 * label, saved forever. The exception is a closing bracket with an opening
 * one inside the URL, which is how half of Wikipedia addresses itself
 * (`/wiki/Mercury_(planet)`).
 */
function trimSentencePunctuation(url: string): string {
  let trimmed = url
  for (;;) {
    const last = trimmed.slice(-1)
    if ('.,;:!?"\''.includes(last)) {
      trimmed = trimmed.slice(0, -1)
      continue
    }
    if (last === ')' && !trimmed.includes('(')) {
      trimmed = trimmed.slice(0, -1)
      continue
    }
    if (last === ']' && !trimmed.includes('[')) {
      trimmed = trimmed.slice(0, -1)
      continue
    }
    // A trim that ate the URL itself is not a trim; hand back what arrived.
    return looksLikeUrl(trimmed) ? trimmed : url
  }
}

/**
 * The words without the joiner that was holding them to the URL. A share
 * reading "Some title — https://…" leaves "Some title —" behind, which is a
 * dash pointing at nothing. A colon is left alone: "worth a read:" is a
 * sentence, and the one it introduces is the link itself.
 */
function trimDanglingJoiner(prose: string): string {
  return prose.trim().replace(/[\s—–\-|·,]+$/, '').trim()
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
  // Failing that, a URL sitting at one end of the shared text is still the
  // thing being shared, and the words around it are the note — see
  // `splitEdgeUrl`. Only consulted when no `url` parameter arrived; when one
  // did, the text is whatever the app chose to say about it.
  //
  // Note which of the two gets its punctuation trimmed: a URL read *out of
  // prose* can have the sentence's full stop stuck to it, while the `url`
  // parameter is a structured field an app filled in deliberately, and is
  // passed through exactly as given.
  const split = !url && text && !textIsBareUrl ? splitEdgeUrl(text) : null
  const prose = split ? split.prose : textIsBareUrl ? '' : text
  const locator = url || (textIsBareUrl ? trimSentencePunctuation(text) : split?.url || '')

  const bodyParts: string[] = []
  if (prose) bodyParts.push(prose)
  // Only add the title when the shared text doesn't already carry it —
  // sharing a selection from an article commonly sends both, duplicated.
  if (title && !bodyParts.some((part) => part.includes(title))) bodyParts.push(title)

  const body = bodyParts.join('\n\n').trim()

  // A bare link with no words at all is still worth keeping — the locator
  // carries it, and the body is left for you to say why.
  if (!body && !locator) return null

  // ── A wordless share is the URL, not an empty thing ────────────────────
  // A link shared with no title and no text at all — which is what most
  // messaging apps send — used to arrive as `{ body: '', locator: url }`,
  // and a thing with an empty body is one Silva can never repair: the
  // article's title only ever replaces a body that is *nothing but* a URL
  // (lib/linkFacts.ts), and an empty string is not that. It sat in the
  // forest as a blank headline over a preview card, permanently.
  //
  // Putting the URL in the body instead puts the share back on exactly the
  // path a *pasted* URL already takes: `intakeFields` moves it into `link`,
  // Keep swaps it for the article's own title, and until then the plate
  // prints it once rather than twice.
  if (!body && locator) return { body: locator, locator: '' }

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
