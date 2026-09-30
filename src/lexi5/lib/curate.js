import { noThinking } from '../../shared/anthropic'

/**
 * The Messages API body for an AI Curation run. Pulled out of Settings.jsx so the
 * live check (scripts/anthropic.live.test.js) sends exactly what the app sends.
 *
 * @param {{ model: string, wordCount: number, theme?: string, exclusions?: string }} opts
 */
export function curationRequest({ model, wordCount, theme = '', exclusions = '' }) {
  // ~6 tokens/word covers the quotes, comma, and occasional multi-token word with
  // headroom; a fixed 4096 ceiling risked truncating the largest allowed requests.
  const maxTokens = Math.min(8192, Math.max(1024, Math.round(wordCount * 6) + 200))
  return {
    model,
    max_tokens: maxTokens,
    // A word list has no reasoning to do, so thinking would be wasted cost and
    // latency, and it counts against max_tokens, which is sized for the words alone.
    ...noThinking(model),
    messages: [{ role: 'user', content: `Generate a JSON array of exactly ${wordCount} interesting, REAL 5-letter English words for a word game. All words must be valid dictionary words.${theme ? ` They must all relate to this theme: ${theme}. If you run out of highly relevant words before reaching ${wordCount}, stop early—do NOT pad with unrelated words.` : ` If you run out of good words before reaching ${wordCount}, stop early—do NOT pad with fake words.`}${exclusions} Only output the raw JSON array of strings, nothing else.` }]
  }
}
