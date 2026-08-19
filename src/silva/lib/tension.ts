/**
 * Tension confirmation — the one provocation kind SILVA.md marks "embeddings
 * + model" rather than "embeddings" alone (see lib/provocations.ts's
 * `gatherTension`, which only narrows the field to topically-related-but-not-
 * near-identical candidate pairs; a real contradiction has to be confirmed by
 * the model, one pair at a time, never scored for the whole candidate pool up
 * front).
 *
 * Goes through the same `/api/anthropic-proxy` Vercel rewrite Lexi5 uses
 * (see src/lexi5/components/Settings.jsx) — a transparent passthrough to
 * api.anthropic.com, not a real server-side proxy, which is why the
 * `anthropic-dangerous-direct-browser-access` header (baked into
 * requestAnthropic) is required.
 */

import { requestAnthropic, extractAnthropicText, MODEL_HAIKU } from '../../shared/anthropic'
import type { Thing } from './notion'

const PROXY_ENDPOINT = '/api/anthropic-proxy/v1/messages'

function buildPrompt(a: Thing, b: Thing): string {
  return `Two passages someone kept in their private commonplace book:\n\nA: "${a.body}"\n\nB: "${b.body}"\n\nDo these two genuinely pull in different directions — a real tension, contradiction, or disagreement in outlook, not just different topics? Answer with exactly one word, "yes" or "no", nothing else.`
}

/**
 * Asks the model whether two kept things are in real tension. Never throws —
 * a network failure, a missing/invalid key, or an unparseable reply all just
 * mean "not confirmed," so the caller's fallback is always to show nothing
 * rather than something wrong (SILVA.md's provocations are a nudge, never
 * a bug report).
 */
export async function confirmTension(apiKey: string, a: Thing, b: Thing): Promise<boolean> {
  if (!apiKey) return false
  try {
    const res = await requestAnthropic(
      apiKey,
      {
        model: MODEL_HAIKU,
        max_tokens: 8,
        messages: [{ role: 'user', content: buildPrompt(a, b) }],
      },
      { endpoint: PROXY_ENDPOINT },
    )
    if (!res.ok) return false
    const payload = await res.json().catch(() => null)
    const text = extractAnthropicText(payload).trim().toLowerCase()
    return text.startsWith('yes')
  } catch {
    return false
  }
}
