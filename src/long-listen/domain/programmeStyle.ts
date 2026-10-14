/**
 * The small conventions of a printed concert programme, as words: a part's
 * Roman numeral and its ordinal ("the second part, of three"), a duration in
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

const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth']
const CARDINAL = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']

/** "The second part, of three" — "The only part" when there is one. */
export function partWords(n: number, of: number): string {
  if (of <= 1) return 'The only part'
  const ord = ORDINAL[n - 1] ?? `${n}th`
  const all = CARDINAL[of - 1] ?? String(of)
  return `The ${ord} part, of ${all}`
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
