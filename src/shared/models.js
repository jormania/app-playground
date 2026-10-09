// The Claude models the apps call, and the one request setting that has changed
// shape between releases. Every call site takes its model id from here, so moving
// a tier to a newer model is an edit in this file — then `npm run test:live`,
// which sends each app's real request once and fails on any the API rejects.
// See AI_MODELS.md.
//
// Plain JS, with models.d.ts beside it, because api/generate-law-of-the-day.js
// imports it too and the serverless functions import only .js from src/.

/** The fast, cheap tier: parsing, tagging, one-line prose. */
export const MODEL_HAIKU = 'claude-haiku-5-5'
/** The tier for work that needs judgement or taste. */
export const MODEL_SONNET = 'claude-sonnet-5-5'

// What to send to keep a model from extended thinking, for a short, bounded
// reply where thinking would only spend max_tokens before the answer. The
// right field differs by model and a wrong one is a 400:
// - Haiku 5.5 thinks by default (Haiku 4.5 didn't), and every Haiku caller
//   has a small max_tokens sized for the answer alone, so thinking would
//   spend it first. `{ type: 'disabled' }` is accepted at its default effort
//   (medium) and anything up to high.
// - Sonnet 5.5 thinks by default and rejects `{ type: 'disabled' }`;
//   `between_tools` is its lowest setting — no extended thinking — and is
//   valid at the default effort, with no other field inside `thinking`.
const NO_THINKING = {
  [MODEL_HAIKU]: { thinking: { type: 'disabled' } },
  [MODEL_SONNET]: { thinking: { type: 'between_tools' } },
}

/**
 * List prices, USD per million tokens, for an app that shows what it has spent
 * (The Long Listen, Settings → About). From platform.claude.com/docs/en/about-claude/pricing,
 * 2026-10-09; update with the ids. Cache reads are 0.05x input on Sonnet 5.5 and
 * 0.1x on Haiku 5.5, 5-minute cache writes 1.25x on both. Haiku 5.5's rates
 * rise fivefold for a prompt over 100,000 tokens, which no app here sends.
 * Web search: $10 per 1,000 searches.
 */
export const PRICES = {
  [MODEL_HAIKU]: { input: 0.10, output: 0.50, cacheRead: 0.01, cacheWrite: 0.125 },
  [MODEL_SONNET]: { input: 2, output: 10, cacheRead: 0.10, cacheWrite: 2.50 },
}
export const WEB_SEARCH_PRICE = 0.01

/**
 * Request fields that keep `model` from thinking — spread them into the body.
 * Throws for a model with no entry, so a new id can't go out with a guess;
 * models.test.js fails first if an exported model is missing one.
 *
 * @param {string} model
 * @returns {Record<string, unknown>}
 */
export function noThinking(model) {
  const fields = NO_THINKING[model]
  if (!fields) throw new Error(`noThinking: no entry for ${model} — add one in src/shared/models.js`)
  return structuredClone(fields)
}
