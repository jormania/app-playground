// The Claude models the apps call, and the one request setting that has changed
// shape between releases. Every call site takes its model id from here, so moving
// a tier to a newer model is an edit in this file — then `npm run test:live`,
// which sends each app's real request once and fails on any the API rejects.
// See AI_MODELS.md.
//
// Plain JS, with models.d.ts beside it, because api/generate-law-of-the-day.js
// imports it too and the serverless functions import only .js from src/.

/** The fast, cheap tier: parsing, tagging, one-line prose. */
export const MODEL_HAIKU = 'claude-haiku-4-5-20251001'
/** The tier for work that needs judgement or taste. */
export const MODEL_SONNET = 'claude-sonnet-5-5'

// What to send to keep a model from extended thinking, for a short, bounded
// reply where thinking would only spend max_tokens before the answer. The
// right field differs by model and a wrong one is a 400:
// - Haiku 4.5 doesn't think unless asked, so nothing is sent.
// - Sonnet 5.5 thinks by default and rejects `{ type: 'disabled' }`;
//   `between_tools` is its lowest setting — no extended thinking — and is
//   valid at the default effort, with no other field inside `thinking`.
const NO_THINKING = {
  [MODEL_HAIKU]: {},
  [MODEL_SONNET]: { thinking: { type: 'between_tools' } },
}

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
