// A fresh scenario and explanation for today's law, written by Claude on this
// device with the listener's own key (Settings), the same way every app in the
// playground calls Claude: straight from the browser, nothing on a server.
//
// It used to be a Vercel cron that rewrote one law a day into Blob storage,
// whether or not anyone opened the app, with a key held on Vercel. Now it runs
// only on a day the app is opened with a key set, for the law actually shown,
// and the result is kept for that day (storage.js), so it costs one request at
// most per day used. Without a key, or if anything fails, the bundled text in
// laws.json is shown — it always was the fallback.
import { requestAnthropic, extractAnthropicText, MODEL_SONNET, noThinking } from '../../shared/anthropic'
import { titleLeakWords, scenarioLeaksTitle } from './leakCheck'

const MODEL = MODEL_SONNET
const MAX_ATTEMPTS = 2
const MIN_FIELD_CHARS = 30

const SCHEMA = {
  type: 'object',
  properties: {
    scenarioText: { type: 'string' },
    explanationText: { type: 'string' },
  },
  required: ['scenarioText', 'explanationText'],
  additionalProperties: false,
}

/**
 * One attempt's Messages API request. Exported so the live check
 * (scripts/anthropic.live.test.js) sends exactly this.
 */
export function generationRequest(system, messages) {
  return {
    model: MODEL,
    max_tokens: 2000,
    thinking: { type: 'adaptive' },
    system,
    // Explicit, because Sonnet 5.5 recalibrated its effort levels; medium leaves
    // the thinking well inside max_tokens for two short paragraphs.
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
    messages,
  }
}

/** The smallest real request, for Settings → "Test the key". */
export function pingRequest() {
  return {
    model: MODEL,
    max_tokens: 16,
    ...noThinking(MODEL),
    messages: [{ role: 'user', content: 'Reply with the single word: ready' }],
  }
}

export function buildPrompt(law, referenceLaws) {
  const examples = referenceLaws
    .map((l) => `Law "${l.lawTitle}":\nscenarioText: ${l.scenarioText}\nexplanationText: ${l.explanationText}`)
    .join('\n\n')

  const leakWords = titleLeakWords(law.lawTitle)
  const leakClause = leakWords.length
    ? ` Do NOT use any of these distinctive words from the title, or their obvious inflections (plurals, verb tenses), anywhere in scenarioText: ${leakWords.map((w) => `"${w}"`).join(', ')}. The scenario must let a reader deduce the law from the situation alone, never from a word lifted out of its name.`
    : ''

  const system = `You write short original content for a daily quiz app based on Robert Greene's "The 48 Laws of Power". You are given a fixed law title — you do not choose which law, and you never reveal the answer inside the scenario. Write only the two requested fields.`

  const user = `Write a fresh scenarioText and explanationText for this law:

Law title: "${law.lawTitle}"

Constraints:
- scenarioText: 2-4 original sentences (~40-70 words) depicting a contemporary, relatable, concrete situation (workplace, friendship, dating, social media, family, business, sports, school, etc.) where this law's dynamic is at play. Do not name the law, mention Robert Greene, or reference the book.${leakClause}
- explanationText: 2-4 original sentences that name the law being demonstrated and explain, in your own words, why the scenario exemplifies it.
- Wholly original prose — do not quote or closely paraphrase any published text from "The 48 Laws of Power".
- Keep sentences short enough to read comfortably on a phone quiz card.
- Make this scenario clearly different from the reference examples below (different domain/situation), even though it illustrates the same law as one of them if applicable.

Reference examples of the style/length/tone (for other laws, for calibration only):

${examples}`

  return { system, user }
}

/** The same invariants laws.test.js holds the bundled text to, plus the leak
 *  rule. An error string to feed back to the model, or null when clean. */
export function validateGenerated(generated, law) {
  if (typeof generated?.scenarioText !== 'string' || typeof generated?.explanationText !== 'string') {
    return 'Response was missing scenarioText or explanationText.'
  }
  if (generated.scenarioText.trim().length < MIN_FIELD_CHARS || generated.explanationText.trim().length < MIN_FIELD_CHARS) {
    return 'scenarioText and explanationText must each be at least a couple of full sentences.'
  }
  const leaks = scenarioLeaksTitle(generated.scenarioText, law.lawTitle)
  if (leaks.length) {
    return `scenarioText leaked these forbidden title words: ${leaks.join(', ')}. Rewrite it without them or any inflection of them.`
  }
  return null
}

/**
 * Write a fresh scenario/explanation for `law`. Resolves to
 * `{ scenarioText, explanationText }`, or null on any failure — a bad key, no
 * network, a refusal, or two drafts that fail validation — so the caller falls
 * back to the bundled text. A rejected draft is answered once with what was
 * wrong, appended to the same conversation.
 */
export async function generateFresh(apiKey, law, laws, { fetchImpl, signal } = {}) {
  if (!apiKey?.trim() || !law) return null
  const referenceLaws = laws.filter((l) => l.id !== law.id).slice(0, 3)
  const { system, user } = buildPrompt(law, referenceLaws)
  const messages = [{ role: 'user', content: user }]
  try {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const res = await requestAnthropic(apiKey.trim(), generationRequest(system, messages), { fetchImpl, signal })
      if (!res.ok) return null
      const payload = await res.json()
      if (payload?.stop_reason === 'refusal' || payload?.stop_reason === 'max_tokens') return null
      const text = extractAnthropicText(payload)
      let candidate = null
      try { candidate = JSON.parse(text) } catch { /* treated as a rejected draft below */ }
      const problem = validateGenerated(candidate, law)
      if (!problem) return { scenarioText: candidate.scenarioText.trim(), explanationText: candidate.explanationText.trim() }
      messages.push({ role: 'assistant', content: text || '{}' })
      messages.push({ role: 'user', content: `That draft was rejected: ${problem} Return corrected scenarioText and explanationText.` })
    }
    return null
  } catch {
    return null
  }
}

/** Settings → "Test the key": 'ok', or a short reason a person can act on. */
export async function testKey(apiKey, { fetchImpl } = {}) {
  if (!apiKey?.trim()) return 'Add a key first.'
  try {
    const res = await requestAnthropic(apiKey.trim(), pingRequest(), { fetchImpl })
    if (res.ok) return 'ok'
    if (res.status === 401 || res.status === 403) return 'Anthropic didn’t accept that key.'
    if (res.status === 400) return 'The key works, but the request was refused — the account may have no credit left.'
    if (res.status === 429 || res.status === 529) return 'Anthropic is busy just now. Try again in a minute.'
    return 'That didn’t work. Try again later.'
  } catch {
    return 'No connection.'
  }
}
