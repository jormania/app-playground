/**
 * The client-side Anthropic call — every app here that calls Claude does it the
 * same way: BYO key, straight from the browser (or through a Vercel rewrite
 * that just forwards to api.anthropic.com, as Lexi5 does to dodge the same
 * origin's `credentialless` policy), with the
 * `anthropic-dangerous-direct-browser-access` header, no server, nothing
 * stored.
 *
 * Promoted from six apps hand-rolling this fetch call — fit-check/lib/tagging,
 * lexi5, where-it-went/lib/aiParser, sol-odyssey/lib/companion,
 * daily-stoic/lib/mentor, touch-grass/engine — once Silva became the seventh.
 * Each app keeps its own prompt building, response parsing and user-facing
 * error copy; only the request itself (endpoint, headers, model ids) moved
 * here, so every app's existing tests still assert their own behaviour.
 */

export const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages'
export const ANTHROPIC_VERSION = '2023-06-01'

/** The two model ids in use across the repo today. Callers that need a
 *  specific one still name it explicitly — nothing here picks a default. */
export const MODEL_HAIKU = 'claude-haiku-4-5-20251001'
export const MODEL_SONNET = 'claude-sonnet-5'

export function anthropicHeaders(apiKey: string): Record<string, string> {
  return {
    'x-api-key': apiKey,
    'anthropic-version': ANTHROPIC_VERSION,
    'anthropic-dangerous-direct-browser-access': 'true',
    'content-type': 'application/json',
  }
}

export interface RequestAnthropicOptions {
  /** Defaults to api.anthropic.com direct; Lexi5 passes its `/api/anthropic-proxy`
   *  rewrite instead — same shape, forwarded by Vercel rather than called direct. */
  endpoint?: string
  fetchImpl?: typeof fetch
  signal?: AbortSignal
}

/**
 * POST a `/v1/messages` body to Anthropic (or a same-shaped proxy). Returns the
 * raw `Response` — callers keep their own status/error handling and response
 * parsing, since those differ app to app (user-facing copy, timeout wrapping,
 * streaming vs not).
 */
export function requestAnthropic(
  apiKey: string,
  body: Record<string, unknown>,
  options: RequestAnthropicOptions = {},
): Promise<Response> {
  const { endpoint = ANTHROPIC_ENDPOINT, fetchImpl = fetch, signal } = options
  return fetchImpl(endpoint, {
    method: 'POST',
    headers: anthropicHeaders(apiKey),
    body: JSON.stringify(body),
    signal,
  })
}

/** Pull the concatenated text out of a `/v1/messages` response payload's
 *  content blocks. Empty string if there's nothing text-shaped in it. */
export function extractAnthropicText(payload: unknown): string {
  const blocks = (payload as { content?: unknown })?.content
  if (!Array.isArray(blocks)) return ''
  return blocks
    .filter((b): b is { type?: string; text?: string } => !!b && typeof b === 'object')
    .map((b) => (typeof b.text === 'string' ? b.text : ''))
    .join('')
}
