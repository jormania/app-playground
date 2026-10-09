// Semantic checks on the curator's structured output — the rules a JSON schema
// cannot express. Each validator returns { value, problems }: `value` is the
// cleaned output (empty strings turned into absences, unknown ids dropped),
// `problems` are the reasons to ask again. The caller retries once with the
// problems as a correction, then accepts the cleaned value if it still stands.
//
// Pure functions, no I/O — src/long-listen/curator/curator.test.js pins them.
import { sameWork, performersKey, fold, surname } from '../domain/identity.js'

const MOODS = ['immersive', 'curious', 'adventurous']

const clean = (s) => (typeof s === 'string' ? s.trim() : '')
const opt = (s) => clean(s) || undefined
const list = (a, max = 8) => (Array.isArray(a) ? a.map(clean).filter(Boolean).slice(0, max) : [])

function cleanSoloists(a) {
  return (Array.isArray(a) ? a : [])
    .map((s) => ({ name: clean(s?.name), instrument: opt(s?.instrument) }))
    .filter((s) => s.name)
}

/** The performers of an item or perspective, normalised. */
export function cleanPerformers(p) {
  return {
    conductor: opt(p?.conductor),
    orchestra: opt(p?.orchestra),
    ensemble: opt(p?.ensemble),
    soloists: cleanSoloists(p?.soloists),
    year: opt(p?.year),
  }
}

export function hasPerformers(p) {
  return Boolean(p.conductor || p.orchestra || p.ensemble || p.soloists.length)
}

// ── themes ────────────────────────────────────────────────────────────────

/**
 * @param {any} out
 * @param {{ threadIds: string[] }} ctx
 */
export function validateThemes(out, { threadIds }) {
  const problems = []
  const known = new Set(threadIds)
  const raw = Array.isArray(out?.options) ? out.options : []
  const options = raw.map((o) => {
    const themeId = clean(o?.returningThemeId)
    const returning = themeId && known.has(themeId)
      ? { themeId, note: clean(o?.continuityNote) }
      : undefined
    if (themeId && !known.has(themeId)) problems.push(`Option "${clean(o?.title)}" returns to an unknown thread ${themeId}.`)
    return {
      mood: MOODS.includes(o?.mood) ? o.mood : undefined,
      title: clean(o?.title),
      pitch: clean(o?.pitch),
      character: list(o?.character, 5),
      why: clean(o?.why),
      angle: clean(o?.angle),
      returning,
    }
  })

  if (options.length !== 3) problems.push(`Expected exactly three options, got ${options.length}.`)
  const moods = options.map((o) => o.mood)
  if (new Set(moods).size !== moods.length || moods.some((m) => !m)) {
    problems.push('The three options must be one immersive, one curious and one adventurous.')
  }
  for (const o of options) {
    if (!o.title || !o.pitch) problems.push('Every option needs a title and a pitch.')
  }
  const titles = options.map((o) => o.title.toLowerCase())
  if (new Set(titles).size !== titles.length) problems.push('Two options share a title.')
  if (options.filter((o) => o.returning).length > 2) problems.push('At most two options may return to earlier threads.')
  for (const o of options) {
    if (o.returning && !o.returning.note) problems.push(`Option "${o.title}" returns to a thread but has no continuityNote.`)
  }

  return { value: { options: options.slice(0, 3) }, problems }
}

// ── programme ─────────────────────────────────────────────────────────────

function cleanItem(i) {
  return {
    composer: clean(i?.composer),
    workTitle: clean(i?.workTitle),
    catalogue: opt(i?.catalogue),
    composed: opt(i?.composed),
    form: opt(i?.form),
    workContext: opt(i?.workContext),
    ...cleanPerformers(i),
    character: list(i?.character, 5),
    why: clean(i?.why),
    whyThisRecording: clean(i?.whyThisRecording),
    listenFor: list(i?.listenFor, 5),
    revisitReason: opt(i?.revisitReason),
  }
}

/**
 * @param {any} out
 * @param {{ covered: {composer: string, title: string, catalogue?: string}[], returning: boolean }} ctx
 */
export function validateProgramme(out, { covered = [], returning = false } = {}) {
  const problems = []
  const sections = (Array.isArray(out?.sections) ? out.sections : []).map((s) => ({
    role: clean(s?.role).toLowerCase() || 'then',
    heading: clean(s?.heading),
    note: opt(s?.note),
    items: (Array.isArray(s?.items) ? s.items : []).map(cleanItem),
  }))

  for (const s of sections) {
    for (const i of s.items) {
      if (!i.composer || !i.workTitle) problems.push('An item has no composer or work title.')
      else if (!hasPerformers(i)) problems.push(`"${i.composer} — ${i.workTitle}" names no performers; every item must be a specific recording.`)
    }
    s.items = s.items.filter((i) => i.composer && i.workTitle && hasPerformers(i))
  }
  const kept = sections.filter((s) => s.items.length > 0)
  const items = kept.flatMap((s) => s.items)

  const repeats = items.filter(
    (i) => !i.revisitReason && covered.some((c) => sameWork({ composer: i.composer, title: i.workTitle, catalogue: i.catalogue }, c)),
  )
  for (const r of repeats) {
    problems.push(`"${r.composer} — ${r.workTitle}" was already explored in this thread. Choose something not yet covered, or give a revisitReason.`)
  }
  // Within one programme, the same work twice is a comparison, not two items.
  const seen = []
  for (const i of items) {
    const w = { composer: i.composer, title: i.workTitle, catalogue: i.catalogue }
    if (seen.some((s) => sameWork(s, w))) problems.push(`"${i.composer} — ${i.workTitle}" appears twice; use a comparison for two interpretations.`)
    seen.push(w)
  }

  if (items.length < 3) problems.push(`Only ${items.length} usable items; a programme needs at least three recordings.`)
  if (items.length > 9) problems.push(`${items.length} items is too many for a week.`)

  const comparisons = (Array.isArray(out?.comparisons) ? out.comparisons : [])
    .map((c) => ({
      composer: clean(c?.composer),
      workTitle: clean(c?.workTitle),
      catalogue: opt(c?.catalogue),
      framing: clean(c?.framing),
      whyBoth: clean(c?.whyBoth),
      perspectives: (Array.isArray(c?.perspectives) ? c.perspectives : []).map((p) => ({
        ...cleanPerformers(p),
        character: clean(p?.character),
        listenFor: opt(p?.listenFor),
      })),
    }))
    .filter((c) => {
      if (!c.composer || !c.workTitle || c.perspectives.length !== 2) return false
      const [a, b] = c.perspectives
      return hasPerformers(a) && hasPerformers(b) && performersKey(a) !== performersKey(b)
    })
    .slice(0, 2)

  const introduction = clean(out?.introduction)
  if (!clean(out?.title) || !introduction) problems.push('The programme needs a title and an introduction.')
  const continuityNote = opt(out?.continuityNote)
  if (returning && !continuityNote) problems.push('This is a return to an earlier thread: write a continuityNote naming what came before and how this week continues.')

  return {
    value: {
      title: clean(out?.title),
      dek: clean(out?.dek),
      introduction,
      whyNow: clean(out?.whyNow),
      historicalPlace: clean(out?.historicalPlace),
      howTheyRelate: clean(out?.howTheyRelate),
      continuityNote,
      sections: kept,
      comparisons,
    },
    problems,
    repeats: repeats.length,
  }
}

/**
 * Last resort after a retry: drop unjustified repeats if what remains is still
 * a programme. Returning to a theme must expand it, so a repeat never survives
 * silently — it is removed, and the caller says so.
 */
export function stripRepeats(value, covered) {
  const isRepeat = (i) => !i.revisitReason && covered.some((c) => sameWork({ composer: i.composer, title: i.workTitle, catalogue: i.catalogue }, c))
  const sections = value.sections
    .map((s) => ({ ...s, items: s.items.filter((i) => !isRepeat(i)) }))
    .filter((s) => s.items.length > 0)
  return { ...value, sections }
}

// ── taste ─────────────────────────────────────────────────────────────────

/**
 * @param {any} out
 * @param {{ feedbackIds: string[], observationIds: string[] }} ctx
 */
export function validateTaste(out, { feedbackIds, observationIds }) {
  const problems = []
  const fb = new Set(feedbackIds)
  const obs = new Set(observationIds)
  const observations = (Array.isArray(out?.observations) ? out.observations : [])
    .map((o) => ({
      facet: clean(o?.facet) || 'other',
      subject: clean(o?.subject),
      statement: clean(o?.statement),
      stance: clean(o?.stance) || 'mixed',
      confidence: clean(o?.confidence) || 'tentative',
      evidence: list(o?.evidence, 20).filter((id) => fb.has(id)),
      replaces: obs.has(clean(o?.replaces)) ? clean(o?.replaces) : undefined,
    }))
    .filter((o) => {
      if (!o.statement || !o.subject) return false
      if (o.evidence.length === 0) {
        problems.push(`Observation "${o.statement}" cites no feedback.`)
        return false
      }
      return true
    })
  // A dropped observation with no evidence is not worth a second call unless
  // nothing at all survived — then the reading is worth asking for again.
  return { value: { observations, questions: list(out?.questions, 3) }, problems: observations.length ? [] : problems }
}

// ── continuity, explain, compare ──────────────────────────────────────────

export function validateContinuity(out) {
  const value = {
    reaction: clean(out?.reaction),
    openQuestions: list(out?.openQuestions, 4),
    adjacentTopics: list(out?.adjacentTopics, 4),
    nextDirections: list(out?.nextDirections, 4),
    closingNote: clean(out?.closingNote),
  }
  const problems = value.nextDirections.length === 0 ? ['Give at least one next direction.'] : []
  return { value, problems }
}

export function validateExplain(out) {
  const value = { heading: clean(out?.heading), body: clean(out?.body) }
  return { value, problems: value.body ? [] : ['The note is empty.'] }
}

/**
 * @param {any} out
 * @param {{ current: object, alreadyHeard: object[] }} ctx
 */
/** Is the recording's lead performer credited on one of these real Spotify albums? */
export function onCandidateList(p, candidates) {
  const lead = p.conductor ?? p.soloists[0]?.name ?? p.ensemble ?? p.orchestra
  if (!lead) return false
  const last = fold(surname(lead))
  return candidates.some((c) => (c.artists ?? []).some((a) => new RegExp(`\\b${last}\\b`).test(fold(a))))
}

export function validateCompare(out, { current, alreadyHeard = [], spotifyCandidates = [] }) {
  const other = { ...cleanPerformers(out?.other), character: clean(out?.other?.character), listenFor: opt(out?.other?.listenFor) }
  const problems = []
  if (!hasPerformers(other)) problems.push('The second recording names no performers.')
  else if (spotifyCandidates.length && !onCandidateList(other, spotifyCandidates)) {
    problems.push('The replacement must be one of the recordings in "spotifyCandidates", named with the performers Spotify credits.')
  }
  const key = performersKey(other)
  if (key === performersKey(cleanPerformers(current)) || alreadyHeard.some((h) => performersKey(cleanPerformers(h)) === key)) {
    problems.push('The second recording must differ from the current one and from those already heard.')
  }
  return {
    value: {
      framing: clean(out?.framing),
      whyBoth: clean(out?.whyBoth),
      current: { character: clean(out?.current?.character), listenFor: opt(out?.current?.listenFor) },
      other,
    },
    problems,
  }
}

// ── resources ─────────────────────────────────────────────────────────────

/** For comparing URLs: no fragment, no trailing slash, lowercased host. */
export function normaliseUrl(u) {
  try {
    const url = new URL(u)
    url.hash = ''
    url.host = url.host.toLowerCase()
    return url.toString().replace(/\/$/, '')
  } catch {
    return ''
  }
}

/** Pull the first {...} JSON object out of a model's final text. */
export function extractJsonObject(text) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
}

/**
 * Keep only resources whose URL came back from a real web search in this very
 * response. Anything else — however plausible — is dropped: the curator may
 * not invent URLs.
 *
 * @param {any} parsed
 * @param {{url: string, title: string}[]} searchResults
 */
export function validateResources(parsed, searchResults) {
  const found = new Map(searchResults.map((r) => [normaliseUrl(r.url), r]))
  const seen = new Set()
  const dropped = []
  const resources = []
  for (const r of Array.isArray(parsed?.resources) ? parsed.resources : []) {
    const url = normaliseUrl(clean(r?.url))
    const kind = ['read', 'watch', 'listen'].includes(r?.kind) ? r.kind : undefined
    if (!url || !found.has(url)) { dropped.push(clean(r?.url)); continue }
    if (!kind || seen.has(url)) continue
    seen.add(url)
    resources.push({
      kind,
      title: clean(r?.title) || found.get(url).title,
      url: found.get(url).url,
      source: clean(r?.source) || new URL(url).host.replace(/^www\./, ''),
      purpose: clean(r?.purpose),
      relatesTo: opt(r?.relatesTo),
    })
  }
  return { value: { resources: resources.slice(0, 7) }, dropped }
}
