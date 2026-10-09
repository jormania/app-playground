// The curator: builds each job's request, calls Claude from the browser with
// the listener's own key — the same way every app in the playground does
// (src/shared/anthropic.ts: BYO key, `anthropic-dangerous-direct-browser-access`,
// nothing stored anywhere but this device) — validates what comes back, and
// asks once more with the problems if needed.
//
// Plain JS with curator.d.ts beside it, like domain/identity.js: the prompts
// and validators were written for a server first and stay framework-free.
//
// Facts vs curation (LONG_LISTEN.md §5): what Claude returns here is the
// CURATORIAL layer — choices, sequencing, explanations, what to listen for, and
// a proposed recording by name. Nothing here is trusted as metadata. Each
// proposed recording is verified against Spotify before it gets a link, and
// resource URLs are only kept if they came back from a real web search in the
// same response.
import { MODEL_HAIKU, MODEL_SONNET, noThinking } from '../../shared/models.js'
import { requestAnthropic } from '../../shared/anthropic'
import { CuratorUnavailable, friendly } from '../curation/api'
import { PROMPTS } from './prompts.js'
import {
  validateThemes, validateProgramme, stripRepeats, enforceVariety, validateTaste, validateContinuity,
  validateExplain, validateCompare, validateResources, extractJsonObject, weekAdjusted, validateCompanion, validateConcert,
} from './validate.js'

export const MODEL = MODEL_SONNET

/**
 * The curating itself — directions, programmes, a second perspective — stays on
 * Sonnet: it is what the listener is paying for. The jobs around it read and
 * summarise (taste from feedback, a thread's week, a little more context, and
 * further reading found by web search) and go to Haiku at a twentieth of the
 * price. Each job's prompt and validator are the same on either model.
 *
 * Reading a concert programme stays on Sonnet: a screenshot of a Romanian
 * hall's page, read into works Spotify can find, is a job where knowing the
 * repertoire is the point, and it comes up a few times a month (a few cents).
 */
const MODEL_FOR = { taste: MODEL_HAIKU, continuity: MODEL_HAIKU, explain: MODEL_HAIKU, resources: MODEL_HAIKU, companion: MODEL_HAIKU }
export function modelFor(op) {
  return MODEL_FOR[op] ?? MODEL
}

const MAX_CONTEXT_CHARS = 150_000

/** The listener-facing framing for each job, ahead of the JSON context. */
const LEADS = {
  themes: (p) => `Today is ${p.today}, the listening week ${p.week?.label ?? p.week?.key}. Propose this week's three directions.`,
  programme: (p) => `Build the programme for this week's chosen direction, "${p.option?.title}". ${p.thread ? `This RETURNS to the thread "${p.thread.title}" (stage ${p.thread.stage}): continue it — new route, new works, new interpretations — never restart it. Works already covered in this thread are listed under thread.covered.` : 'This is a new theme.'}`,
  taste: () => 'Here is the current understanding of the listener\'s taste and their new feedback. Return only new or changed observations.',
  continuity: (p) => `The week ${p.exploration?.weekKey} of the thread "${p.thread?.title}" has ended. Update the thread.`,
  explain: (p) => `The listener asked for more context on ${p.item?.composer} — ${p.item?.workTitle}${p.question ? `, with this question: "${p.question}"` : ''}.`,
  compare: (p) => `The listener wants a second perspective on ${p.work?.composer} — ${p.work?.title}.`,
  resources: (p) => `Find resources for this week's programme, "${p.programme?.title}".`,
  concert: (p) => `Read this concert programme. If it shows no year, it is ${p.year}.`,
  companion: (p) => `Write the listening companion for ${p.works?.length ?? 0} recording(s) in "${p.programme?.title}": one note per track.`,
}

export function buildUserContent(op, payload) {
  const json = JSON.stringify(payload)
  if (json.length > MAX_CONTEXT_CHARS) throw new CuratorUnavailable('failed', 'The listening history is too large to send in one go.')
  return `${LEADS[op](payload)}\n\n<listener_context>\n${json}\n</listener_context>`
}

/**
 * The wire body for one structured job. Exported so the live API check
 * (scripts/anthropic.live.test.js) sends exactly this.
 */
export function curatorBody(op, userContent) {
  const prompt = PROMPTS[op]
  return {
    model: modelFor(op),
    max_tokens: prompt.maxTokens,
    thinking: { type: 'adaptive' },
    system: [{ type: 'text', text: prompt.system, cache_control: { type: 'ephemeral' } }],
    output_config: { effort: prompt.effort, format: { type: 'json_schema', schema: prompt.schema } },
    messages: [{ role: 'user', content: userContent }],
  }
}

/** The wire body for one turn of the resource search. Exported for the live check. */
export function resourcesBody(userContent, priorTurns = []) {
  const prompt = PROMPTS.resources
  return {
    model: modelFor('resources'),
    max_tokens: prompt.maxTokens,
    thinking: { type: 'adaptive' },
    system: [{ type: 'text', text: prompt.system, cache_control: { type: 'ephemeral' } }],
    output_config: { effort: prompt.effort },
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: prompt.maxSearches }],
    messages: [{ role: 'user', content: userContent }, ...priorTurns],
  }
}

/**
 * The smallest real request, for Settings → "Test the key". Exported for the
 * live check. No thinking: it only has to prove the key and the model answer.
 */
export function pingBody() {
  return {
    model: MODEL,
    max_tokens: 16,
    ...noThinking(MODEL),
    messages: [{ role: 'user', content: 'Reply with the single word: ready' }],
  }
}

/** Anthropic keys look like this; anything else is refused before it costs a call. */
export function looksLikeAnthropicKey(key) {
  return typeof key === 'string' && /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(key.trim())
}

/**
 * One Messages API call with the listener's key, as a `send(body) → message`.
 * Every failure becomes a CuratorUnavailable with words a listener can read;
 * nothing from Anthropic's error body is shown.
 */
export function anthropicSender(apiKey, fetchImpl) {
  return async (body) => {
    let res
    try {
      res = await requestAnthropic(apiKey, body, fetchImpl ? { fetchImpl } : {})
    } catch {
      throw new CuratorUnavailable('offline', friendly('offline'))
    }
    if (res.status === 401 || res.status === 403) throw new CuratorUnavailable('bad-key', friendly('bad-key'))
    if (res.status === 429 || res.status === 529) throw new CuratorUnavailable('busy', friendly('busy'))
    if (!res.ok) throw new CuratorUnavailable('failed', friendly('failed'))
    return res.json()
  }
}

function textOf(message) {
  return (message.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('')
}

async function structured(send, op, userContent) {
  const message = await send(curatorBody(op, userContent))
  if (message.stop_reason === 'refusal') throw new CuratorUnavailable('declined', friendly('declined'))
  if (message.stop_reason === 'max_tokens') throw new CuratorUnavailable('failed', 'The curator ran out of room. Try again.')
  const text = textOf(message)
  try {
    return { output: JSON.parse(text), text }
  } catch {
    throw new CuratorUnavailable('failed', 'The curator returned something unreadable. Try again.')
  }
}

/**
 * Run one structured job, validate, and if there are problems ask once more
 * with them listed. The retry is a fresh single-turn request that carries the
 * previous answer as data, so no conversation history (or thinking block) is
 * ever replayed or edited.
 */
async function withRetry(send, op, payload, validate) {
  const userContent = buildUserContent(op, payload)
  const first = await structured(send, op, userContent)
  const checked = validate(first.output)
  // Problems the code fixes afterwards (validate's `mendable`) never cost a retry.
  const mendable = new Set(checked.mendable ?? [])
  if (checked.problems.every((p) => mendable.has(p))) return { ...checked, attempts: 1 }

  const correction = `${userContent}\n\n<previous_answer>\n${first.text}\n</previous_answer>\n\nYour previous answer had these problems. Return the full corrected JSON:\n- ${checked.problems.join('\n- ')}`
  const second = await structured(send, op, correction)
  return { ...validate(second.output), attempts: 2 }
}

// ── the jobs ──────────────────────────────────────────────────────────────

export async function generateThemes(send, payload) {
  const threadIds = (payload.context?.threads ?? []).map((t) => t.themeId)
  const pairs = payload.context?.preferences?.pairs !== false
  const r = await withRetry(send, 'themes', payload, (o) => validateThemes(o, { threadIds, pairs }))
  if (r.value.options.length !== 3 || r.problems.some((p) => /exactly three|one immersive|title and a pitch/.test(p))) {
    throw new CuratorUnavailable('failed', 'The curator could not settle on three directions. Try again.')
  }
  return { options: r.value.options, promptVersion: PROMPTS.themes.version, model: MODEL }
}

export async function curateProgramme(send, payload) {
  const covered = payload.thread?.covered?.works ?? []
  const returning = Boolean(payload.thread)
  // This week's mood moves the standing preferences a step for this week only.
  const preferences = weekAdjusted(payload.preferences ?? {}, payload.thisWeek)
  // "More of this theme" is a companion, shorter than a week: size isn't checked against the week's length.
  const sized = payload.extension ? { ...preferences, timePerWeek: undefined } : preferences
  const form = payload.option?.form ?? 'theme'
  const r = await withRetry(send, 'programme', payload, (o) => validateProgramme(o, { covered, returning, preferences: sized, form }))
  // An extension is a companion to the week, not sized by it: the variety rules
  // still hold, the length cap is the widest week's.
  let value = enforceVariety(r.value, preferences, payload.extension ? { maxWorks: 16, form } : { form })
  let removedRepeats = 0
  if (r.repeats > 0) {
    const before = value.sections.reduce((n, s) => n + s.items.length, 0)
    value = stripRepeats(value, covered)
    removedRepeats = before - value.sections.reduce((n, s) => n + s.items.length, 0)
  }
  const count = value.sections.reduce((n, s) => n + s.items.length, 0)
  if (count < 3 || !value.title) throw new CuratorUnavailable('failed', 'The curator could not assemble a programme. Try again.')
  return { programme: value, removedRepeats, promptVersion: PROMPTS.programme.version, model: MODEL }
}

export async function interpretTaste(send, payload) {
  const feedbackIds = (payload.feedback ?? []).map((f) => f.id)
  const observationIds = (payload.profile?.observations ?? []).map((o) => o.id)
  const r = await withRetry(send, 'taste', payload, (o) => validateTaste(o, { feedbackIds, observationIds }))
  return { ...r.value, promptVersion: PROMPTS.taste.version }
}

export async function planContinuity(send, payload) {
  const r = await withRetry(send, 'continuity', payload, validateContinuity)
  return { ...r.value, promptVersion: PROMPTS.continuity.version }
}

export async function explainWork(send, payload) {
  const r = await withRetry(send, 'explain', payload, validateExplain)
  if (!r.value.body) throw new CuratorUnavailable('failed', 'The curator had nothing to add this time.')
  return { ...r.value, promptVersion: PROMPTS.explain.version }
}

export async function writeCompanion(send, payload) {
  const works = (payload.works ?? []).map((w) => ({ key: w.key, tracks: w.tracks ?? [] }))
  const r = await withRetry(send, 'companion', payload, (o) => validateCompanion(o, { works }))
  if (!r.value.works.length) throw new CuratorUnavailable('failed', 'The curator had nothing to add this time.')
  return { ...r.value, promptVersion: PROMPTS.companion.version }
}

/**
 * A concert programme, read from a screenshot (Sonnet, image in — a few
 * cents). One attempt: the listener checks the result in a form.
 * payload: { image: { mediaType, data (base64) }, year }
 */
export async function readConcert(send, payload) {
  const { image, ...rest } = payload ?? {}
  if (!image?.data) throw new CuratorUnavailable('failed', 'There was no picture to read.')
  const content = [
    { type: 'image', source: { type: 'base64', media_type: image.mediaType || 'image/jpeg', data: image.data } },
    { type: 'text', text: LEADS.concert(rest) },
  ]
  const { output } = await structured(send, 'concert', content)
  const { value, problems } = validateConcert(output)
  if (problems.length) throw new CuratorUnavailable('failed', 'No works could be read from that picture. Try a clearer screenshot, or type it in.')
  return { ...value, promptVersion: PROMPTS.concert.version }
}

export async function compareInterpretations(send, payload) {
  const r = await withRetry(send, 'compare', payload, (o) => validateCompare(o, { current: payload.current, alreadyHeard: payload.alreadyHeard, spotifyCandidates: payload.spotifyCandidates }))
  if (r.problems.length) throw new CuratorUnavailable('failed', 'The curator could not find a contrasting recording.')
  return { ...r.value, promptVersion: PROMPTS.compare.version }
}

/** Every web_search_result the model actually received, across all turns. */
export function searchResultsOf(messages) {
  const out = []
  for (const m of messages) {
    for (const block of m.content ?? []) {
      if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
        for (const r of block.content) if (r.type === 'web_search_result' && r.url) out.push({ url: r.url, title: r.title ?? '' })
      }
    }
  }
  return out
}

/**
 * Resources, found with Anthropic's own web search. A URL survives only if it
 * appeared in a search result in these very responses. (A browser can't check
 * a foreign page for a 404 — CORS — so that check went with the server.)
 */
export async function findResources(send, payload) {
  const userContent = buildUserContent('resources', payload)
  const responses = []
  let prior = []
  // A server-tool turn can pause mid-search; continuing means sending its
  // content back as the assistant turn, append-only.
  for (let turn = 0; turn < 3; turn++) {
    const message = await send(resourcesBody(userContent, prior))
    responses.push(message)
    if (message.stop_reason === 'refusal') throw new CuratorUnavailable('declined', friendly('declined'))
    if (message.stop_reason !== 'pause_turn') break
    prior = [...prior, { role: 'assistant', content: message.content }]
  }
  const results = searchResultsOf(responses)
  const parsed = extractJsonObject(textOf(responses[responses.length - 1]))
  const { value, dropped } = validateResources(parsed, results)
  return { ...value, dropped: dropped.length, promptVersion: PROMPTS.resources.version }
}

export async function ping(send) {
  const message = await send(pingBody())
  return { ok: true, model: message.model }
}

export const JOBS = {
  ping,
  themes: generateThemes,
  programme: curateProgramme,
  taste: interpretTaste,
  continuity: planContinuity,
  explain: explainWork,
  compare: compareInterpretations,
  resources: findResources,
  companion: writeCompanion,
  concert: readConcert,
}

/**
 * The curator as the app uses it: `call(op, payload)`, with the key read
 * fresh from Settings on every call. `send` can be injected for tests.
 */
export function directCurator(getKey, { fetchImpl, send, onUsage } = {}) {
  return {
    async call(op, payload) {
      const job = JOBS[op]
      if (!job) throw new CuratorUnavailable('failed', friendly('failed'))
      const key = (getKey() ?? '').trim()
      if (!send) {
        if (!key) throw new CuratorUnavailable('locked', friendly('locked'))
        if (!looksLikeAnthropicKey(key)) throw new CuratorUnavailable('bad-key', 'That doesn’t look like an Anthropic key — it starts with sk-ant-.')
      }
      const base = send ?? anthropicSender(key, fetchImpl)
      // Every request's usage, as Anthropic reports it, for Settings → Development.
      const metered = onUsage
        ? async (body) => {
            const message = await base(body)
            try { onUsage(op, message?.model ?? body.model, message?.usage) } catch { /* never let accounting break a job */ }
            return message
          }
        : base
      return job(metered, payload ?? {})
    },
  }
}

export { promptVersions } from './prompts.js'
