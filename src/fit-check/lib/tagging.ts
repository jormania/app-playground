/**
 * Photo → tags, in one shot.
 *
 * The only AI in the app that touches a garment, and it is deliberately
 * one-shot: send the picture, get a suggestion, done. No conversation, no
 * context, no follow-up turns. The recommender (M4) never calls this — that
 * path stays deterministic.
 *
 * Everything the model returns is a SUGGESTION. It lands in the form for Nora
 * to accept or change; nothing is written to Notion off the back of it without
 * passing through `lib/vocabulary.ts` first. That matters more here than
 * anywhere else in the app: an unregistered `multi_select` option makes Notion
 * reject the entire property patch, so a model inventing "dusty rose" would
 * take the whole garment write down with it. The prompt asks for the closed
 * vocabulary; `parseTagResponse` enforces it. The prompt is a request, the
 * parser is the guarantee.
 */
import { resizePhoto } from '../../shared/photo.ts'
import {
  CATEGORIES, COLOURS, STYLES, WARMTHS,
  coerceMany, coerceOne, vocabularyForPrompt,
  type Category, type Colour, type Style, type Warmth,
} from './vocabulary.ts'

const MODEL = 'claude-haiku-4-5-20251001'
/** Generous but bounded — without it a hung connection leaves the form stuck. */
const REQUEST_TIMEOUT_MS = 20000
/**
 * The photo is stored at 1600px, but the model does not need that to tell a
 * denim jacket from a dress. 768px keeps the request small and fast on a phone
 * connection; garment recognition does not improve above it.
 */
const VISION_MAX_EDGE = 768

export interface SuggestedTags {
  /** A short human name, e.g. "Blue denim jacket". Null if unusable. */
  name: string | null
  category: Category | null
  colours: Colour[]
  warmth: Warmth | null
  styles: Style[]
}

/**
 * A fresh empty result. A factory rather than a shared constant on purpose:
 * spreading a constant (`{ ...EMPTY_TAGS }`) is a SHALLOW copy, so every caller
 * would receive the same `colours` and `styles` arrays and one caller's edit
 * would leak into every later result. The form mutates these directly as Nora
 * corrects tags, so that aliasing was a real bug, not a theoretical one.
 */
export function emptyTags(): SuggestedTags {
  return { name: null, category: null, colours: [], warmth: null, styles: [] }
}

/** Frozen, for comparisons. Never spread this — call `emptyTags()`. */
export const EMPTY_TAGS: Readonly<SuggestedTags> = Object.freeze({
  name: null, category: null, colours: Object.freeze([]) as unknown as [], warmth: null,
  styles: Object.freeze([]) as unknown as [],
})

const SYSTEM = `You identify a single item of clothing in a photo and tag it.

Answer with ONLY a JSON object, no prose and no code fence:
{"name": string, "category": string, "colours": string[], "warmth": string, "styles": string[]}

"name" is a short, plain description a teenager would actually use — three or
four words, like "Blue denim jacket" or "White cotton tee". No brand names, no
prices, no flattery.

Every other value MUST come from these exact lists. Never invent a value; if
nothing fits, omit that field entirely rather than guessing:

${vocabularyForPrompt()}

If the photo shows more than one garment, tag the most prominent one.`

/**
 * Pull `SuggestedTags` out of whatever the model actually said.
 *
 * Deliberately forgiving about SHAPE and utterly strict about VALUES. Models
 * wrap JSON in prose or code fences, return a single string where an array was
 * asked for, or vary casing — none of that is worth failing over. But a value
 * outside the vocabulary is dropped, always, because that is the one that
 * breaks a Notion write.
 *
 * Never throws. A completely unparseable response yields empty tags, which
 * simply means Nora fills the form herself.
 */
export function parseTagResponse(raw: string): SuggestedTags {
  const json = extractJsonObject(raw)
  if (!json) return emptyTags()

  let data: Record<string, unknown>
  try {
    const parsed = JSON.parse(json)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return emptyTags()
    data = parsed as Record<string, unknown>
  } catch {
    return emptyTags()
  }

  return {
    name: cleanName(data.name),
    category: coerceOne(CATEGORIES, data.category),
    colours: coerceMany(COLOURS, asArray(data.colours)),
    warmth: coerceOne(WARMTHS, data.warmth),
    styles: coerceMany(STYLES, asArray(data.styles)),
  }
}

/** A lone string where a list was expected is a common model slip, not an error. */
function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') return value.split(',').map((s) => s.trim())
  return []
}

function cleanName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  // Collapse whitespace and cap the length — the name becomes a Notion title
  // and shows under a 106px tile, so a sentence is worse than nothing.
  const cleaned = value.replace(/\s+/g, ' ').trim().slice(0, 60)
  return cleaned || null
}

/**
 * Find the first balanced `{...}` in a string, ignoring braces inside strings.
 * A plain `indexOf('{')`/`lastIndexOf('}')` breaks the moment the model adds a
 * trailing sentence containing a brace.
 */
function extractJsonObject(raw: string): string | null {
  if (typeof raw !== 'string') return null
  const start = raw.indexOf('{')
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return raw.slice(start, i + 1)
    }
  }
  return null
}

export class TaggingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TaggingError'
  }
}

/**
 * Ask Claude what this garment is.
 *
 * Called direct from the browser (`anthropic-dangerous-direct-browser-access`),
 * matching WhereItWent — and required here, because the repo is at Vercel
 * Hobby's 12-function cap and cannot take a relay of its own.
 */
export async function suggestTags(apiKey: string, photo: Blob): Promise<SuggestedTags> {
  if (!apiKey) throw new TaggingError('Add your AI key in Settings to tag photos automatically.')

  const small = await resizePhoto(photo as Blob & { type: string }, { maxEdge: VISION_MAX_EDGE })
  const base64 = await blobToBase64(small)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        temperature: 0,
        system: SYSTEM,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
            { type: 'text', text: 'Tag this garment.' },
          ],
        }],
      }),
      signal: controller.signal,
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      throw new TaggingError('Tagging took too long. Add the tags yourself, or try again.')
    }
    throw new TaggingError(`Could not reach the AI service: ${(e as Error).message}`)
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    let message = `Tagging failed (${res.status})`
    try { message = (await res.json())?.error?.message || message } catch { /* non-JSON body */ }
    if (res.status === 401) message = 'That AI key was rejected. Check it in Settings.'
    throw new TaggingError(message)
  }

  const payload = await res.json()
  const text = (payload?.content || [])
    .filter((b: { type?: string }) => b?.type === 'text')
    .map((b: { text?: string }) => b.text || '')
    .join('')

  return parseTagResponse(text)
}

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  // Chunked: a single String.fromCharCode(...bytes) blows the call stack on
  // anything above ~100KB.
  const CHUNK = 8192
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}
