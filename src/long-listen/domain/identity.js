/**
 * Identity for music named in prose.
 *
 * Plain JS with identity.d.ts beside it, because the curator endpoint
 * (api/_lib/longListen/) checks a returning theme's programme against what the
 * thread already covered, and serverless functions import only .js from src/ —
 * the same arrangement as src/shared/models.js.
 *
 * The curator writes "Symphony No. 5 in C-sharp minor" one month and "Symphony
 * No. 5" the next. Continuity depends on recognising those as one Work, and on
 * recognising "Boulez / Vienna Philharmonic" as one Recording — otherwise a
 * returning theme cannot know what it already covered. These keys are
 * deliberately conservative: a false merge (two works treated as one) would
 * hide music from the listener, which is worse than a missed one.
 */

/** Lowercase, strip accents and punctuation, collapse spaces. */
export function fold(s) {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/Ł/g, 'L')
    .replace(/ø/g, 'o')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[’'`"“”]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const KEY_SIGNATURE = /\bin [a-g](?:[ -]?(?:sharp|flat|dur|moll))?(?: (?:major|minor))?\b/g
const NUMBER_WORDS = /\b(?:no|nr|number|op|opus)\b/g

/** The parts of a work title that identify it, without its key or numbering noise. */
export function workTitleKey(title) {
  return fold(title)
    .replace(KEY_SIGNATURE, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(NUMBER_WORDS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function catalogueKey(catalogue) {
  return catalogue ? fold(catalogue).replace(/\s+/g, '') : ''
}

/** Stable id for an artist of a kind: `conductor:pierre-boulez`. */
export function artistId(kind, name) {
  return `${kind}:${fold(name).replace(/ /g, '-')}`
}

export function workId(composer, title) {
  return `work:${fold(composer).replace(/ /g, '-')}:${workTitleKey(title).replace(/ /g, '-')}`
}

/**
 * Same composer, and either the same title key or the same catalogue number.
 * A title that merely contains the other ("Symphony 5" in "Symphony 5 Adagietto")
 * is NOT a match — a movement is not its symphony.
 *
 * @param {{composer: string, title: string, catalogue?: string}} a
 * @param {{composer: string, title: string, catalogue?: string}} b
 */
export function sameWork(a, b) {
  if (fold(a.composer) !== fold(b.composer)) return false
  if (workTitleKey(a.title) === workTitleKey(b.title)) return true
  const ca = catalogueKey(a.catalogue)
  return ca !== '' && ca === catalogueKey(b.catalogue)
}

/** Who performs it, as one key: conductor | orchestra-or-ensemble | soloists. */
export function performersKey(r) {
  const soloists = r.soloists.map((s) => fold(s.name)).sort().join('+')
  return [fold(r.conductor ?? ''), fold(r.orchestra ?? r.ensemble ?? ''), soloists].join('|')
}

export function recordingId(workIdValue, r) {
  return `rec:${workIdValue.slice(5)}:${performersKey(r).replace(/ /g, '-')}`
}

/** A short, readable credit line: "Boulez · Vienna Philharmonic". */
export function creditLine(r) {
  const parts = []
  for (const s of r.soloists) parts.push(s.name)
  if (r.conductor) parts.push(r.conductor)
  if (r.orchestra) parts.push(r.orchestra)
  else if (r.ensemble) parts.push(r.ensemble)
  return parts.join(' · ')
}

/** Surname, for search queries and matching: "Pierre Boulez" → "boulez". */
export function surname(name) {
  const words = fold(name).split(' ').filter(Boolean)
  return words[words.length - 1] ?? ''
}

let counter = 0
/** A fresh id for things that have no natural key (events, feedback). */
export function newId(prefix) {
  counter = (counter + 1) % 1_000_000
  const rand = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${rand}`
}
