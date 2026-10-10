/**
 * Identity for music named in prose.
 *
 * Plain JS with identity.d.ts beside it, because the curator's validators
 * (curator/validate.js, plain JS) check a returning theme's programme against
 * what the thread already covered.
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

/**
 * A nickname, bracketed or in quotes: `(Scottish)`, `[Eroica]`, `"Unfinished"`,
 * `„Neterminata”`. Taken off the raw title, before fold() strips the brackets
 * and quote marks that show where it starts and ends. Single quotes are left
 * alone: they are as often an apostrophe ("L'apprenti sorcier").
 */
const NICKNAME = /\([^)]*\)|\[[^\]]*\]|"[^"]*"|“[^”]*”|„[^“”]*[“”]|«[^»]*»/g

/** A catalogue designation closing a title: ", Op. 82", "BWV 1048", "K. 550", "D. 759", "Hob. I:104". */
const TRAILING_CATALOGUE = /[\s,;]*\b((?:op(?:us)?|bwv|kv?|d|hob|rv|hwv|woo)\.?\s*(?:[ivxlc]+\s*[:.]\s*)?\d+[a-z]?)\s*$/i

/** "No. 8" / "Nr. 8": a title's own number, which a shared opus does not override. */
const TITLE_NUMBER = /\b(?:no|nr|number)\.?\s*(\d+)/gi

/** The title without its nicknames, and the catalogue written at its end, if any. */
function splitTitle(title) {
  const plain = String(title ?? '').replace(NICKNAME, ' ').replace(/[\s,;:–—-]+$/, '')
  const m = TRAILING_CATALOGUE.exec(plain)
  if (!m) return { rest: plain, catalogue: '' }
  const rest = plain.slice(0, m.index)
  // Only a catalogue beside a number is noise in the key ("Symphony No. 5, Op. 82").
  // In "Cantata, BWV 140" it is all that tells one cantata from the next.
  return /\d/.test(rest) ? { rest, catalogue: m[1] } : { rest: plain, catalogue: m[1] }
}

/** The catalogue designation a title carries at its end, or '': "Symphony No. 8, D. 759" → "D. 759". */
export function titleCatalogue(title) {
  return splitTitle(title).catalogue
}

/** The parts of a work title that identify it, without its key, nickname, catalogue or numbering noise. */
export function workTitleKey(title) {
  return fold(splitTitle(title).rest)
    .replace(KEY_SIGNATURE, ' ')
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
  // A catalogue written into the title counts when the field is empty.
  const ca = catalogueKey(a.catalogue || titleCatalogue(a.title))
  if (ca === '' || ca !== catalogueKey(b.catalogue || titleCatalogue(b.title))) return false
  // One opus can hold many pieces (Slavonic Dances, Op. 46): titles numbered
  // differently are different pieces, whatever catalogue they share.
  const na = titleNumbers(a.title)
  const nb = titleNumbers(b.title)
  return !na.length || !nb.length || na.join(' ') === nb.join(' ')
}

function titleNumbers(title) {
  return [...splitTitle(title).rest.matchAll(TITLE_NUMBER)].map((m) => String(Number(m[1])))
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

const GENERATION = new Set(['i', 'ii', 'iii', 'iv', 'jr', 'sr', 'junior', 'senior'])

/**
 * Surname, for search queries and matching: "Pierre Boulez" → "boulez". A
 * generational suffix is not a surname: "Johann Strauss II" → "strauss", as is
 * "the Elder" ("Pieter Bruegel the Elder").
 */
export function surname(name) {
  const words = fold(name).split(' ').filter(Boolean)
  if (words.length > 2 && words[words.length - 2] === 'the' && /^(elder|younger)$/.test(words[words.length - 1])) words.splice(-2)
  while (words.length > 1 && GENERATION.has(words[words.length - 1])) words.pop()
  return words[words.length - 1] ?? ''
}

/** The surname as written, for a line a person reads: "Johann Strauss II" → "Strauss". */
export function displaySurname(name) {
  const key = surname(name)
  // Searched from the end, whole written words: "Rimsky-Korsakov" stays hyphenated.
  const written = String(name ?? '').trim().split(/\s+/).reverse().find((w) => fold(w).split(' ').pop() === key)
  return written ?? (key ? key.charAt(0).toUpperCase() + key.slice(1) : '')
}

let counter = 0
/** A fresh id for things that have no natural key (events, feedback). */
export function newId(prefix) {
  counter = (counter + 1) % 1_000_000
  const rand = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${rand}`
}
