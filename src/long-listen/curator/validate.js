// Semantic checks on the curator's structured output — the rules a JSON schema
// cannot express. Each validator returns { value, problems }: `value` is the
// cleaned output (empty strings turned into absences, unknown ids dropped),
// `problems` are the reasons to ask again. The caller retries once with the
// problems as a correction, then accepts the cleaned value if it still stands.
//
// Pure functions, no I/O — src/long-listen/curator/curator.test.js pins them.
import { sameWork, performersKey, fold, surname, workTitleKey } from '../domain/identity.js'

const MOODS = ['immersive', 'curious', 'adventurous']
const FORMS = ['theme', 'across-centuries', 'then-and-now', 'city-year', 'performer', 'dialogue', 'many-ways']

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

/**
 * A work with a soloist, by its title: a concerto (not a "Concerto for
 * Orchestra" or a concerto grosso, which have none to name), a concertante,
 * or a work "for violin and orchestra". Its recording must name the soloists.
 */
export function needsSoloists(title, form) {
  const t = String(title ?? '').toLowerCase()
  if (/concerto for orchestra|concerto grosso|concerti grossi/.test(t)) return false
  if (/\bconcert(o|i|ante)\b|sinfonia concertante|konzert|concertstück|konzertstück/.test(t)) return true
  if (/\bfor (solo )?(piano|violin|viola|cello|violoncello|double bass|flute|oboe|clarinet|bassoon|horn|trumpet|trombone|guitar|harp|organ|saxophone)\b[^.]*\borchestra\b/.test(t)) return true
  return form === 'concerto'
}

// ── themes ────────────────────────────────────────────────────────────────

/**
 * @param {any} out
 * @param {{ threadIds: string[] }} ctx
 */
export function validateThemes(out, { threadIds, pairs = true }) {
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
      form: FORMS.includes(o?.form) ? o.form : 'theme',
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
  // "One work, several ways" needs pairs; without them it's a plain theme.
  if (!pairs) for (const o of options) if (o.form === 'many-ways') o.form = 'theme'

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
const VERSION_WORDS = /\b(orch|orchestrat\w*|arr|arranged|arrangement|transcr\w*|version|original|reduction|edition|ed|after)\b/i

/**
 * A work's title without the note that says which version it is:
 * "Pictures at an Exhibition, orch. Ravel" and "Pictures at an Exhibition
 * (original piano version)" are one work. Only trailing segments are cut,
 * and only when they speak of a version — "Symphony No. 5, Op. 67" stays.
 */
export function baseTitle(title) {
  const parts = String(title ?? '').replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').split(/\s*[,;:–—]\s+|\s+-\s+/)
  const at = parts.findIndex((p, i) => i > 0 && VERSION_WORDS.test(p))
  return (at > 0 ? parts.slice(0, at) : parts).join(' ').replace(/\s+/g, ' ').trim()
}

/** One key for every version of a piece: composer + base title. */
export function baseWorkKey(composer, title) {
  return `${fold(surname(composer ?? ''))}|${workTitleKey(baseTitle(title))}`
}

/** How many works a week of this length holds — mirrors domain/exploration.ts TIME. */
const WORKS_FOR = { short: [3, 4], standard: [5, 7], generous: [8, 10], abundant: [11, 14] }
const TIME_STEPS = ['short', 'standard', 'generous', 'abundant']

/**
 * "This week, differently", applied to the standing preferences for one week:
 * shorter is one step less time, wider one step more breadth, more familiar
 * one step towards the well known. Quieter has no number; the prompt carries it.
 * Used for the checks, so a shorter week isn't sent back for having too few works.
 */
export function weekAdjusted(preferences = {}, thisWeek = []) {
  const p = { ...preferences }
  const has = (m) => Array.isArray(thisWeek) && thisWeek.includes(m)
  if (has('shorter') && p.timePerWeek) p.timePerWeek = TIME_STEPS[Math.max(0, TIME_STEPS.indexOf(p.timePerWeek) - 1)] ?? p.timePerWeek
  if (has('wider')) p.breadth = Math.min(5, Number(p.breadth ?? 3) + 1)
  if (has('familiar')) p.familiarity = Math.max(1, Number(p.familiarity ?? 3) - 1)
  return p
}

export function validateProgramme(out, { covered = [], returning = false, preferences = {}, form = 'theme' } = {}) {
  const problems = []
  // Problems enforceVariety fixes in code. They are still listed (a retry asked
  // for another reason fixes them too), but they never cost a retry of their own:
  // re-writing a whole programme to drop a duplicate is paying twice for a trim.
  const mendable = []
  const mend = (p) => { problems.push(p); mendable.push(p) }
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
      else if (needsSoloists(i.workTitle, i.form) && !i.soloists.length) problems.push(`"${i.composer} — ${i.workTitle}" has a soloist's part but names no soloist; name each soloist and their instrument.`)
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
    if (seen.some((s) => sameWork(s, w))) mend(`"${i.composer} — ${i.workTitle}" appears twice; use a comparison for two interpretations.`)
    seen.push(w)
  }

  // One version of a piece a week (two only as a pair, when pairs are on).
  const versions = new Map()
  for (const i of items) {
    const k = baseWorkKey(i.composer, i.workTitle)
    versions.set(k, [...(versions.get(k) ?? []), i])
  }
  for (const list of versions.values()) {
    if (list.length > 1) mend(`"${list[0].composer} — ${baseTitle(list[0].workTitle)}" appears in ${list.length} versions; a week holds each work once (arrangements and the original are one work).`)
  }
  // Range: unless the week is about one focus, or two composers in dialogue, no composer more than twice.
  const breadth = Number(preferences.breadth ?? 3)
  if (breadth > 1 && form !== 'dialogue') {
    const byComposer = new Map()
    for (const i of items) byComposer.set(fold(surname(i.composer)), (byComposer.get(fold(surname(i.composer))) ?? 0) + 1)
    for (const [, n] of byComposer) if (n > 2) { mend(`${n} works by one composer; at this breadth, two at most — let the theme travel to other composers and periods.`); break }
  }
  if (kept.length > 4) mend(`${kept.length} sections is too many; use two to four, each holding several works.`)
  const [least, most] = WORKS_FOR[preferences.timePerWeek] ?? [3, 14]
  if (items.length < Math.max(3, least - 1)) problems.push(`Only ${items.length} usable items; this listener's week holds ${least}–${most} works.`)
  if (items.length > most + 2) mend(`${items.length} items is too many; this listener's week holds ${least}–${most} works.`)

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
    // Pairs only when the listener asked for them: one a week, or three in a week about one work heard several ways.
    .slice(0, preferences.pairs ? (form === 'many-ways' ? 3 : 1) : 0)

  const introduction = clean(out?.introduction)
  if (!clean(out?.title) || !introduction) problems.push('The programme needs a title and an introduction.')
  const continuityNote = opt(out?.continuityNote)
  if (returning && !continuityNote) problems.push('This is a return to an earlier thread: write a continuityNote naming what came before and how this week continues.')

  // Mending in code only stands in for a retry when what is left still holds
  // this listener's week; a trim that leaves it thin goes back to the curator.
  if (mendable.length) {
    const left = enforceVariety({ sections: kept }, preferences, { form }).sections.reduce((n, s) => n + s.items.length, 0)
    if (left < Math.max(3, least - 1)) mendable.length = 0
  }

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
    mendable,
    repeats: repeats.length,
  }
}

/**
 * Last resort after a retry: drop unjustified repeats if what remains is still
 * a programme. Returning to a theme must expand it, so a repeat never survives
 * silently — it is removed, and the caller says so.
 */
/**
 * What the listener asked for, enforced rather than hoped for — in code, never
 * by asking the curator again: one version of each work (the first kept);
 * unless the week is about one focus, at most two works by a composer; no more
 * than four sections (later ones fold into the fourth); and no more works than
 * the week holds, plus two.
 */
export function enforceVariety(value, preferences = {}, { maxWorks, form } = {}) {
  const seen = new Set()
  const perComposer = new Map()
  // Two composers in dialogue: several works by each is the point.
  const cap = Number(preferences.breadth ?? 3) > 1 && form !== 'dialogue' ? 2 : Infinity
  const sections = value.sections
    .map((s) => ({
      ...s,
      items: s.items.filter((i) => {
        const k = baseWorkKey(i.composer, i.workTitle)
        const c = fold(surname(i.composer))
        if (seen.has(k) || (perComposer.get(c) ?? 0) >= cap) return false
        seen.add(k)
        perComposer.set(c, (perComposer.get(c) ?? 0) + 1)
        return true
      }),
    }))
    .filter((s) => s.items.length > 0)
  const folded = sections.length > 4
    ? [...sections.slice(0, 3), { ...sections[3], items: sections.slice(3).flatMap((s) => s.items) }]
    : sections
  const cap2 = maxWorks ?? (WORKS_FOR[preferences.timePerWeek]?.[1] ?? 12) + 2
  let left = cap2
  const capped = folded
    .map((s) => { const items = s.items.slice(0, Math.max(0, left)); left -= items.length; return { ...s, items } })
    .filter((s) => s.items.length > 0)
  return { ...value, sections: capped }
}

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

/**
 * The companion's notes, one per track for each work asked about. A work's
 * notes are padded or cut to its track count, so note i always belongs to
 * track i; a work the curator skipped, or got the key of wrong, is a problem.
 * @param {any} out
 * @param {{ works: { key: string, tracks: string[] }[] }} ctx
 */
export function validateCompanion(out, { works }) {
  const problems = []
  const given = new Map((Array.isArray(out?.works) ? out.works : []).map((w) => [clean(w?.key), Array.isArray(w?.movements) ? w.movements.map(clean) : []]))
  const value = { works: [] }
  for (const w of works) {
    const notes = given.get(w.key)
    if (!notes || notes.every((n) => !n)) { problems.push(`No notes for "${w.key}".`); continue }
    value.works.push({ key: w.key, movements: w.tracks.map((_, i) => notes[i] ?? '') })
  }
  return { value, problems }
}

/**
 * A concert read from a screenshot: cleaned, never retried — the listener
 * checks it in a form before anything is kept. A date that isn't a date is
 * dropped rather than guessed.
 */
export function validateConcert(out) {
  const date = clean(out?.date)
  const value = {
    venue: clean(out?.venue),
    hall: opt(out?.hall),
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '',
    time: /^\d{1,2}:\d{2}$/.test(clean(out?.time)) ? clean(out?.time) : undefined,
    orchestra: opt(out?.orchestra),
    conductor: opt(out?.conductor),
    soloists: cleanSoloists(out?.soloists),
    works: (Array.isArray(out?.works) ? out.works : [])
      .map((w) => ({ composer: clean(w?.composer), title: clean(w?.title), catalogue: opt(w?.catalogue) }))
      .filter((w) => w.composer && w.title),
  }
  const problems = value.works.length ? [] : ['No works could be read.']
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
    // Web pages only: these become links, and a javascript: or data: link is a script.
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return ''
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
