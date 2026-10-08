// The curator service: builds each job's request, calls Claude, validates what
// comes back, asks once more with the problems if needed.
//
// Facts vs curation (LONG_LISTEN.md §5): what Claude returns here is the
// CURATORIAL layer — choices, sequencing, explanations, what to listen for, and
// a proposed recording by name. Nothing here is trusted as metadata. The client
// verifies each proposed recording against Spotify before it gets a link, and
// resource URLs are only kept if they came back from a real web search in the
// same response.
import Anthropic from '@anthropic-ai/sdk'
import { MODEL_SONNET, noThinking } from '../../../src/shared/models.js'
import { PROMPTS } from './prompts.js'
import {
  validateThemes, validateProgramme, stripRepeats, validateTaste, validateContinuity,
  validateExplain, validateCompare, validateResources, extractJsonObject,
} from './validate.js'

export const MODEL = MODEL_SONNET

// Server-side refusal fallback: if a safety classifier declines (an orchestral
// programme is very unlikely to trip one, but a false positive should degrade
// to another model rather than to an error page), the API re-runs the request
// on its default fallback inside the same call.
export const CURATOR_BETAS = ['server-side-fallback-2026-07-01']

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
}

export function buildUserContent(op, payload) {
  const json = JSON.stringify(payload)
  if (json.length > MAX_CONTEXT_CHARS) throw new CuratorError('too-large', 'The listening context is too large to send.')
  return `${LEADS[op](payload)}\n\n<listener_context>\n${json}\n</listener_context>`
}

/**
 * The wire body for one structured job. Exported so the live API check
 * (scripts/anthropic.live.test.js) sends exactly this.
 */
export function curatorBody(op, userContent) {
  const prompt = PROMPTS[op]
  return {
    model: MODEL,
    max_tokens: prompt.maxTokens,
    thinking: { type: 'adaptive' },
    system: [{ type: 'text', text: prompt.system, cache_control: { type: 'ephemeral' } }],
    output_config: { effort: prompt.effort, format: { type: 'json_schema', schema: prompt.schema } },
    messages: [{ role: 'user', content: userContent }],
    fallbacks: 'default',
  }
}

/** The wire body for one turn of the resource search. Exported for the live check. */
export function resourcesBody(userContent, priorTurns = []) {
  const prompt = PROMPTS.resources
  return {
    model: MODEL,
    max_tokens: prompt.maxTokens,
    thinking: { type: 'adaptive' },
    system: [{ type: 'text', text: prompt.system, cache_control: { type: 'ephemeral' } }],
    output_config: { effort: prompt.effort },
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: prompt.maxSearches }],
    messages: [{ role: 'user', content: userContent }, ...priorTurns],
    fallbacks: 'default',
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

export class CuratorError extends Error {
  /** @param {'unconfigured'|'bad-key'|'too-large'|'refused'|'invalid'|'upstream'|'rate-limited'} code */
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

function textOf(message) {
  return (message.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('')
}

/** A key the listener pasted in Settings looks like this; anything else is refused before it costs a call. */
export function looksLikeAnthropicKey(key) {
  return typeof key === 'string' && /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(key.trim())
}

export function makeClient(apiKey = process.env.ANTHROPIC_API_KEY) {
  if (!apiKey) throw new CuratorError('unconfigured', 'The curator is not configured.')
  return new Anthropic({ apiKey, maxRetries: 2 })
}

async function send(client, body) {
  try {
    const stream = client.beta.messages.stream({ ...body, betas: CURATOR_BETAS })
    return await stream.finalMessage()
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) throw new CuratorError('bad-key', 'Anthropic didn’t accept that key.')
    if (err instanceof Anthropic.RateLimitError) throw new CuratorError('rate-limited', 'The curator is busy — try again in a minute.')
    if (err instanceof Anthropic.APIError) throw new CuratorError('upstream', `Curator call failed (${err.status ?? 'network'}).`)
    throw new CuratorError('upstream', 'Curator call failed.')
  }
}

async function structured(client, op, userContent) {
  const message = await send(client, curatorBody(op, userContent))
  if (message.stop_reason === 'refusal') throw new CuratorError('refused', 'The curator declined this request.')
  if (message.stop_reason === 'max_tokens') throw new CuratorError('invalid', 'The curator ran out of room.')
  const text = textOf(message)
  try {
    return { output: JSON.parse(text), text }
  } catch {
    throw new CuratorError('invalid', 'The curator returned something unreadable.')
  }
}

/**
 * Run one structured job, validate, and if there are problems ask once more
 * with them listed. The retry is a fresh single-turn request that carries the
 * previous answer as data, so no conversation history (or thinking block) is
 * ever replayed or edited.
 */
async function withRetry(client, op, payload, validate) {
  const userContent = buildUserContent(op, payload)
  const first = await structured(client, op, userContent)
  const checked = validate(first.output)
  if (checked.problems.length === 0) return { ...checked, attempts: 1 }

  const correction = `${userContent}\n\n<previous_answer>\n${first.text}\n</previous_answer>\n\nYour previous answer had these problems. Return the full corrected JSON:\n- ${checked.problems.join('\n- ')}`
  const second = await structured(client, op, correction)
  return { ...validate(second.output), attempts: 2 }
}

// ── the jobs ──────────────────────────────────────────────────────────────

export async function generateThemes(client, payload) {
  const threadIds = (payload.context?.threads ?? []).map((t) => t.themeId)
  const r = await withRetry(client, 'themes', payload, (o) => validateThemes(o, { threadIds }))
  if (r.value.options.length !== 3 || r.problems.some((p) => /exactly three|one immersive|title and a pitch/.test(p))) {
    throw new CuratorError('invalid', 'The curator could not settle on three directions.')
  }
  return { options: r.value.options, promptVersion: PROMPTS.themes.version, model: MODEL }
}

export async function curateProgramme(client, payload) {
  const covered = payload.thread?.covered?.works ?? []
  const returning = Boolean(payload.thread)
  const r = await withRetry(client, 'programme', payload, (o) => validateProgramme(o, { covered, returning }))
  let value = r.value
  let removedRepeats = 0
  if (r.repeats > 0) {
    const before = value.sections.reduce((n, s) => n + s.items.length, 0)
    value = stripRepeats(value, covered)
    removedRepeats = before - value.sections.reduce((n, s) => n + s.items.length, 0)
  }
  const count = value.sections.reduce((n, s) => n + s.items.length, 0)
  if (count < 3 || !value.title) throw new CuratorError('invalid', 'The curator could not assemble a programme.')
  return { programme: value, removedRepeats, promptVersion: PROMPTS.programme.version, model: MODEL }
}

export async function interpretTaste(client, payload) {
  const feedbackIds = (payload.feedback ?? []).map((f) => f.id)
  const observationIds = (payload.profile?.observations ?? []).map((o) => o.id)
  const r = await withRetry(client, 'taste', payload, (o) => validateTaste(o, { feedbackIds, observationIds }))
  return { ...r.value, promptVersion: PROMPTS.taste.version }
}

export async function planContinuity(client, payload) {
  const r = await withRetry(client, 'continuity', payload, validateContinuity)
  return { ...r.value, promptVersion: PROMPTS.continuity.version }
}

export async function explainWork(client, payload) {
  const r = await withRetry(client, 'explain', payload, validateExplain)
  if (!r.value.body) throw new CuratorError('invalid', 'The curator had nothing to add.')
  return { ...r.value, promptVersion: PROMPTS.explain.version }
}

export async function compareInterpretations(client, payload) {
  const r = await withRetry(client, 'compare', payload, (o) => validateCompare(o, { current: payload.current, alreadyHeard: payload.alreadyHeard }))
  if (r.problems.length) throw new CuratorError('invalid', 'The curator could not find a contrasting recording.')
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

export async function findResources(client, payload) {
  const userContent = buildUserContent('resources', payload)
  const responses = []
  let prior = []
  // A server-tool turn can pause mid-search; continuing means sending its
  // content back as the assistant turn, append-only.
  for (let turn = 0; turn < 3; turn++) {
    const message = await send(client, resourcesBody(userContent, prior))
    responses.push(message)
    if (message.stop_reason === 'refusal') throw new CuratorError('refused', 'The curator declined this request.')
    if (message.stop_reason !== 'pause_turn') break
    prior = [...prior, { role: 'assistant', content: message.content }]
  }
  const results = searchResultsOf(responses)
  const parsed = extractJsonObject(textOf(responses[responses.length - 1]))
  const { value, dropped } = validateResources(parsed, results)
  return { ...value, dropped: dropped.length, promptVersion: PROMPTS.resources.version }
}

/** Drop resources whose page is definitively gone. Anything inconclusive stays. */
export async function checkAlive(resources, fetchImpl = fetch) {
  const checks = await Promise.all(resources.map(async (r) => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 4000)
    try {
      const res = await fetchImpl(r.url, { method: 'HEAD', redirect: 'follow', signal: ctrl.signal })
      return res.status !== 404 && res.status !== 410
    } catch {
      return true
    } finally {
      clearTimeout(timer)
    }
  }))
  return resources.filter((_, i) => checks[i])
}

export async function ping(client) {
  try {
    const message = await client.messages.create(pingBody())
    return { ok: true, model: message.model }
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) throw new CuratorError('bad-key', 'Anthropic didn’t accept that key.')
    if (err instanceof Anthropic.RateLimitError) throw new CuratorError('rate-limited', 'Anthropic is rate-limiting this key just now.')
    if (err instanceof Anthropic.APIError) throw new CuratorError('upstream', `Anthropic answered ${err.status ?? 'with an error'}.`)
    throw new CuratorError('upstream', 'Anthropic could not be reached.')
  }
}

export const JOBS = {
  themes: generateThemes,
  programme: curateProgramme,
  taste: interpretTaste,
  continuity: planContinuity,
  explain: explainWork,
  compare: compareInterpretations,
  resources: findResources,
}
