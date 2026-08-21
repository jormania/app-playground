// Structural deduplication + provenance-preserving merge.
//
// The SEMANTIC half of dedupe happens upstream, in /recommend in Bucharest: it can
// read two articles and know they mean the same exhibition. What's left for the app
// is the structural half — the same event arriving across refresh runs, from the
// Radar database, from the Suggested-events page, and from Wanderlist's Findings.
// That half is deterministic, so it lives here, pure and tested.
//
// The governing bias: WHEN IN DOUBT, KEEP SEPARATE. Two cards for one event is a
// mild annoyance. One card that swallowed a different event hides something real.

import { trustScore, uniq, CONFIDENCE_RANK } from './model.js'

// Romanian + English filler that carries no identity. Dropped before comparing, so
// "Expoziția «Lumina»" and "Lumina — expoziție" recognise each other.
const STOP_WORDS = new Set([
  'la', 'le', 'lui', 'de', 'din', 'cu', 'si', 'in', 'pe', 'un', 'o', 'al', 'ale', 'a',
  'the', 'and', 'at', 'of', 'in', 'on', 'with', 'for',
  'expozitia', 'expozitie', 'concert', 'concertul', 'spectacol', 'spectacolul',
  'eveniment', 'evenimentul', 'festival', 'festivalul', 'lansare', 'lansarea',
  'proiectie', 'proiectia', 'vernisaj', 'vernisajul', 'live', 'show',
])

/** Fold diacritics, punctuation and case away so Romanian text compares sanely.
 *  `ș`/`ş` and `ț`/`ţ` both exist in the wild (comma-below vs cedilla) and are the
 *  single most common reason two copies of one title fail to match. */
export function fold(text) {
  return String(text ?? '')
    .normalize('NFD')
    // Strip combining marks: U+0300–U+036F plus comma-below (U+0326) and
    // cedilla (U+0327), which is what `ș`/`ş` and `ț`/`ţ` decompose to.
    .replace(/[\u0300-\u036f\u0326\u0327]/g, '')
    .toLowerCase()
    .replace(/[«»""''`´]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function tokens(text) {
  return fold(text).split(' ').filter((t) => t.length > 1 && !STOP_WORDS.has(t))
}

/** Token-set overlap (Jaccard-ish, biased toward the shorter title so a long
 *  editorial headline still matches the bare event name inside it). */
export function titleSimilarity(a, b) {
  const ta = new Set(tokens(a))
  const tb = new Set(tokens(b))
  if (!ta.size || !tb.size) return 0
  let shared = 0
  for (const t of ta) if (tb.has(t)) shared += 1
  return shared / Math.min(ta.size, tb.size)
}

/** Venue names vary wildly ("ARCUB", "ARCUB — Hanul Gabroveni"), so containment
 *  counts as a match. Returns null when either side is unknown — an ABSENT venue
 *  must not read as a disagreement, only as no evidence either way. */
export function venueSimilarity(a, b) {
  const fa = fold(a)
  const fb = fold(b)
  if (!fa || !fb) return null
  if (fa === fb || fa.includes(fb) || fb.includes(fa)) return 1
  return titleSimilarity(a, b)
}

export function dayOf(iso) {
  return iso ? String(iso).slice(0, 10) : null
}

/** Do two events' date ranges touch? Undated events return null (no evidence),
 *  same as venues. A single-day event is treated as the range [start, start]. */
export function dateOverlap(a, b) {
  const aStart = dayOf(a.start)
  const bStart = dayOf(b.start)
  if (!aStart || !bStart) return null
  const aEnd = dayOf(a.end) || aStart
  const bEnd = dayOf(b.end) || bStart
  return aStart <= bEnd && bStart <= aEnd
}

const TITLE_FLOOR = 0.6
const MATCH_THRESHOLD = 0.72

/** Score how likely two events are the same underlying thing, 0..1.
 *  A hard `key` match short-circuits to 1 — that's the skill's own stable slug. */
export function similarity(a, b) {
  if (a.key && b.key && a.key === b.key) return 1

  const title = titleSimilarity(a.name, b.name)
  // Title is the necessary condition. Nothing else can rescue two different names:
  // "Jazz in the Park" and "Street Delivery" at the same venue on the same night
  // are two events, and a venue+date match must never be allowed to merge them.
  if (title < TITLE_FLOOR) return 0

  const venue = venueSimilarity(a.venue, b.venue)
  const dates = dateOverlap(a, b)

  // A confident disagreement on either axis is disqualifying: same name, different
  // venue is a touring show; same name, non-overlapping dates is a repeat run.
  if (venue !== null && venue < 0.5) return 0
  if (dates === false) return 0

  // Weight the axes we actually have evidence for, so a title-only pair can still
  // match on a strong enough title while a title+venue+date pair matches easily.
  let score = title * 0.6
  let weight = 0.6
  if (venue !== null) { score += venue * 0.25; weight += 0.25 }
  if (dates !== null) { score += (dates ? 1 : 0) * 0.15; weight += 0.15 }
  return score / weight
}

export function isSameEvent(a, b) {
  return similarity(a, b) >= MATCH_THRESHOLD
}

/** Merge a cluster into one event. Each field is taken from the highest-trust
 *  member that actually has it, and `fieldOrigins` records WHICH member won —
 *  so a merged record stays inspectable instead of becoming opaque. */
export function mergeCluster(cluster) {
  const ordered = [...cluster].sort((a, b) => trustScore(b) - trustScore(a))
  const base = ordered[0]
  const merged = { ...base }
  const fieldOrigins = {}

  const FIELDS = ['name', 'start', 'end', 'hasTime', 'venue', 'address', 'area', 'category',
    'summary', 'cost', 'link', 'tickets', 'image', 'organizer']

  for (const field of FIELDS) {
    for (const member of ordered) {
      const value = member[field]
      if (value !== null && value !== undefined && value !== '' && !(field === 'hasTime' && value === false)) {
        merged[field] = value
        fieldOrigins[field] = sourceLabel(member)
        break
      }
    }
  }

  // `start` and `hasTime` are one fact, not two. Taking a precise time from one
  // member and a date from another would invent a time on the wrong day.
  const timeWinner = ordered.find((m) => m.start && m.hasTime)
  if (timeWinner) {
    merged.start = timeWinner.start
    merged.hasTime = true
    fieldOrigins.start = sourceLabel(timeWinner)
  } else {
    merged.hasTime = false
  }

  // Union, never intersection: a source calling something free and another staying
  // silent is not a contradiction, and losing `recommended` on merge would throw
  // away exactly the signal that matters most.
  merged.signals = uniq(ordered.flatMap((m) => m.signals ?? []))
  if (merged.signals.includes('free')) merged.cost = null

  merged.sources = dedupeSources(ordered.flatMap((m) => m.sources ?? []))
  merged.saved = ordered.some((m) => m.saved)
  merged.confidence = ordered.reduce(
    (best, m) => ((CONFIDENCE_RANK[m.confidence] ?? 0) > (CONFIDENCE_RANK[best] ?? 0) ? m.confidence : best),
    'uncertain',
  )
  merged.checked = ordered.map((m) => m.checked).filter(Boolean).sort().pop() ?? null
  merged.mergedFrom = ordered.map((m) => m.id).filter(Boolean)
  merged.fieldOrigins = fieldOrigins
  return merged
}

function sourceLabel(event) {
  return event.sources?.[0]?.name || event.origin || 'unknown'
}

export function dedupeSources(sources) {
  const seen = new Map()
  for (const s of sources) {
    // A source is identified by its URL when it has one — the same article linked
    // from two rows is one mention, not two — and by its name otherwise.
    const id = s.url ? s.url.replace(/[?#].*$/, '') : `name:${fold(s.name)}`
    const existing = seen.get(id)
    if (!existing || (s.date && (!existing.date || s.date > existing.date))) seen.set(id, s)
  }
  return [...seen.values()]
}

/** Single-pass clustering over the whole pool. O(n·clusters) rather than O(n²):
 *  each event is compared against the BEST-scoring existing cluster head, not
 *  against every other event. At one city's weekly event volume that's plenty. */
export function dedupe(events) {
  const clusters = []
  for (const event of events) {
    let best = null
    let bestScore = 0
    for (const cluster of clusters) {
      const score = Math.max(...cluster.map((member) => similarity(event, member)))
      if (score > bestScore) { bestScore = score; best = cluster }
    }
    if (best && bestScore >= MATCH_THRESHOLD) best.push(event)
    else clusters.push([event])
  }
  return clusters.map(mergeCluster)
}
