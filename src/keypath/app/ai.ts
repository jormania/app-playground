import { extractAnthropicText, MODEL_HAIKU, requestAnthropic } from '../../shared/anthropic'
import { readJson, removeJson, writeJson } from '../../shared/storage'

// Claude in KeyPath (KEYPATH_TUTOR.md §9, "The coach's note", "The weekly
// note", "Call and answer"): the phone's key, its test, and the one way every
// feature asks. The key is the phone's, not a player's; each feature builds
// its own prompt and checks the answer before anything is shown.

/** The phone's Anthropic key, kept outside KeyPath's store so a backup file never carries it. */
const KEY = 'keypath:anthropicKey'
export const readAiKey = (): string => readJson<string>(KEY, '')
export function saveAiKey(key: string): void {
  const clean = key.trim()
  if (clean) writeJson(KEY, clean)
  else removeJson(KEY)
}

export interface Ask {
  model: string
  maxTokens: number
  system: string
  user: string
  /** More of the request body, as the API names it (e.g. output_config). */
  extra?: Record<string, unknown>
}

/**
 * One request, its text back. Null on any failure (an error status, a refusal,
 * an answer cut off, no network): the caller shows nothing rather than half.
 */
export async function askClaude(key: string, ask: Ask, options: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {}): Promise<string | null> {
  try {
    const res = await requestAnthropic(
      key,
      { ...ask.extra, model: ask.model, max_tokens: ask.maxTokens, system: ask.system, messages: [{ role: 'user', content: ask.user }] },
      options,
    )
    if (!res.ok) return null
    const payload = (await res.json()) as { stop_reason?: string }
    if (payload.stop_reason === 'refusal' || payload.stop_reason === 'max_tokens') return null
    return extractAnthropicText(payload)
  } catch {
    return null
  }
}

export type KeyCheck = 'ok' | 'bad-key' | 'no-credit' | 'limited' | 'busy' | 'offline' | 'error'

/** One tiny request, to say whether the key works: Settings' "Test". */
export async function testAiKey(key: string, fetchImpl?: typeof fetch): Promise<KeyCheck> {
  let res: Response
  try {
    res = await requestAnthropic(key.trim(), { model: MODEL_HAIKU, max_tokens: 1, messages: [{ role: 'user', content: 'Hi' }] }, { fetchImpl })
  } catch {
    return 'offline'
  }
  if (res.ok) return 'ok'
  if (res.status === 401 || res.status === 403) return 'bad-key'
  if (res.status === 429) return 'limited'
  if (res.status === 529 || res.status >= 500) return 'busy'
  if (res.status === 400) {
    const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
    if (/credit/i.test(body?.error?.message ?? '')) return 'no-credit'
  }
  return 'error'
}
