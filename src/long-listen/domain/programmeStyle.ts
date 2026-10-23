/**
 * The small conventions of a printed concert programme, as words: a part's
 * Roman numeral, a duration in
 * minutes with the prime ("c. 24′"), a recording's movements as a programme
 * lists them, and the one line of a part worth setting large.
 */

const ROMAN: [number, string][] = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]

/** 1 → "I", 4 → "IV", 12 → "XII". Parts and movements never run to forty. */
export function roman(n: number): string {
  let left = Math.max(1, Math.floor(n))
  let out = ''
  for (const [value, mark] of ROMAN) {
    while (left >= value) { out += mark; left -= value }
  }
  return out
}

/** A duration as a programme prints it: "c. 24′". Undefined when unknown. */
export function primeMinutes(ms?: number): string | undefined {
  if (!ms) return undefined
  return `c. ${Math.max(1, Math.round(ms / 60000))}′`
}

const NUMERAL = /^\s*([IVXLC]+)\.\s+/

/**
 * A recording's movements as a programme lists them, from Spotify's track
 * names: the work's title in front of each ("Symphony No. 2 in D Major, Op. 43:
 * I. Allegretto") is dropped when every track carries it, and a movement
 * without its numeral is given one. Fewer than two tracks: none to list.
 */
export function movementTitles(trackNames: string[] | undefined): { numeral: string; title: string }[] {
  const names = (trackNames ?? []).map((n) => n.trim()).filter(Boolean)
  if (names.length < 2) return []
  // The part before the first ": " is the work's title only if every track begins with the same one.
  const prefixes = names.map((n) => (n.includes(': ') ? n.slice(0, n.indexOf(': ')) : null))
  const shared = prefixes[0] !== null && prefixes.every((p) => p === prefixes[0])
  return names.map((name, i) => {
    const rest = shared ? name.slice(name.indexOf(': ') + 2).trim() : name
    const m = NUMERAL.exec(rest)
    return m ? { numeral: m[1], title: rest.slice(m[0].length).trim() } : { numeral: roman(i + 1), title: rest }
  })
}

/**
 * The one line of a part worth setting large: a whole sentence from the
 * curator's notes for its works, of a length that reads at a glance (eight to
 * twenty-four words), the one nearest fourteen. Undefined when no sentence fits.
 */
export function pullQuote(texts: string[]): string | undefined {
  const sentences = texts
    .flatMap((t) => t.split(/(?<=[.!?])\s+(?=[A-Z“"‘'])/))
    .map((x) => x.trim())
    .filter((x) => /[.!?]$/.test(x))
  let best: string | undefined
  let bestGap = Infinity
  for (const sentence of sentences) {
    const words = sentence.split(/\s+/).length
    if (words < 8 || words > 24) continue
    const gap = Math.abs(words - 14)
    if (gap < bestGap) { best = sentence; bestGap = gap }
  }
  return best
}

/** "IV" → 4; 0 for anything that isn't a Roman numeral. */
export function romanValue(numeral: string): number {
  const v: Record<string, number> = { I: 1, V: 5, X: 10, L: 50 }
  const s = numeral.trim().toUpperCase()
  if (!/^[IVXL]+$/.test(s)) return 0
  let total = 0
  for (let i = 0; i < s.length; i++) {
    const cur = v[s[i]]
    const next = v[s[i + 1]] ?? 0
    total += cur < next ? -cur : cur
  }
  return total
}

/** A place in a movement as a clock reads it: 252000 → "4:12". */
export function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/**
 * Which "listen for" points belong to which movement: each is tagged with the
 * work's own numeral ("II") or "" for the whole work. The tags are only
 * trusted when the recording divides the work as the numerals expect — every
 * numeral within its track count — otherwise none is tied by its tag.
 *
 * A point that names its movement in so many words ("the third movement's
 * swans", "the finale") goes there whatever its tag says: a tag is the
 * curator's guess afterwards, the words are what the listener reads, and a
 * point about the swans of the third movement once sat under the first.
 */
export function listenForAt(tags: string[] | undefined, count: number, tracks: number, texts?: string[]): (number | null)[] {
  if (tracks < 2) return Array.from({ length: count }, () => null)
  const tagged = Array.from({ length: count }, (_, k) => (tags?.[k] ? romanValue(tags[k]) || null : null))
  const trusted = !tagged.some((x) => x !== null && x > tracks)
  return tagged.map((x, k) => movementNamedIn(texts?.[k] ?? '', tracks) ?? (trusted ? x : null))
}

const MOVEMENT_ORDINAL: Record<string, number> = { first: 1, opening: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9 }

/** The one movement a sentence names ("the second movement", "the finale"), of a work in `movements`; null when none, or more than one. */
export function movementNamedIn(text: string, movements: number): number | null {
  const named = new Set<number>()
  for (const m of text.matchAll(/\b(first|opening|second|third|fourth|fifth|sixth|seventh|eighth|ninth|last|final|closing)\s+movement/gi)) {
    const w = m[1].toLowerCase()
    named.add(MOVEMENT_ORDINAL[w] ?? movements)
  }
  if (/\bfinale\b/i.test(text)) named.add(movements)
  const [only] = [...named]
  return named.size === 1 && only >= 1 && only <= movements ? only : null
}

/**
 * Straight quotes as a printer sets them: "Angel of Light" → “Angel of Light”,
 * Beethoven's → Beethoven’s. For display only — stored titles stay as written.
 */
export function curly(text: string): string {
  return text
    .replace(/(^|[\s([{\u2014\u2013-])"/g, '$1\u201c')
    .replace(/"/g, '\u201d')
    .replace(/(^|[\s([{\u2014\u2013-])'/g, '$1\u2018')
    .replace(/'/g, '\u2019')
}
