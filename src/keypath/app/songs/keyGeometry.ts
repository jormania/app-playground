import { isBlackKey } from '../../midi/noteNames'

export interface KeyBox {
  pitch: number
  black: boolean
  /** Left edge and width as % of the keyboard's width. */
  left: number
  width: number
}

/** How far each black key sits from the line between its two white keys, in white keys' widths. */
const BLACK_LEAN: Record<number, number> = { 1: -0.1, 3: 0.1, 6: -0.13, 8: 0, 10: 0.13 }

/**
 * Where each key sits, as percentages — shared by the play keyboard and the
 * falling notes above it, so a note lands exactly on its key at any width.
 */
export function keyBoxes(low: number, high: number): KeyBox[] {
  const whites: number[] = []
  for (let n = low; n <= high; n++) if (!isBlackKey(n)) whites.push(n)
  const w = 100 / whites.length
  const index = new Map(whites.map((n, i) => [n, i]))
  const boxes: KeyBox[] = []
  for (let n = low; n <= high; n++) {
    if (isBlackKey(n)) {
      // As on a piano: a little narrower than half again a white key's gap, and not centred on it —
      // C♯ and D♯ lean apart, F♯ and A♯ lean out, G♯ sits in the middle.
      const bw = w * 0.58
      const lean = BLACK_LEAN[((n % 12) + 12) % 12] ?? 0
      boxes.push({ pitch: n, black: true, left: (index.get(n - 1)! + 1) * w - bw / 2 + lean * w, width: bw })
    } else boxes.push({ pitch: n, black: false, left: index.get(n)! * w, width: w })
  }
  return boxes
}

/** The keys to draw for a song: its range, widened to whole octaves from C, always including middle C. */
export function rangeFor(pitches: readonly number[]): { low: number; high: number } {
  const lo = Math.min(60, ...pitches)
  const hi = Math.max(60, ...pitches)
  const low = Math.floor(lo / 12) * 12
  let high = Math.ceil((hi + 1) / 12) * 12
  if (high - low < 12) high = low + 12
  return { low, high }
}

/** The Yamaha's 61 keys: C2 to C7. Nothing is ever drawn outside them. */
export const KEYBOARD = { low: 36, high: 96 } as const

/**
 * A range grown to at least `octaves`, an octave at a time, within the
 * Yamaha's keys. Each octave goes on the side that keeps the keyboard centred
 * nearest middle C, above on a tie (where most beginner tunes sit), so the key
 * everything starts from stays near the middle. Landscape has the width for
 * three octaves at close to real key proportions; a one-octave song otherwise
 * gets keys as wide as a hand.
 */
export function widenRange(range: { low: number; high: number }, octaves: number): { low: number; high: number } {
  let { low, high } = range
  const off = (lo: number, hi: number) => Math.abs((lo + hi) / 2 - 60)
  while ((high - low) / 12 < octaves) {
    const canBelow = low - 12 >= KEYBOARD.low
    const canAbove = high + 12 <= KEYBOARD.high
    if (!canBelow && !canAbove) break
    if (canBelow && (!canAbove || off(low - 12, high) < off(low, high + 12))) low -= 12
    else high += 12
  }
  return { low, high }
}

/**
 * A key's name laid out for a narrow space: "C / Do" (both names) as two
 * lines, and how long the longest line is, so a lone letter can be drawn as
 * large as its key allows and "Sol♯" smaller.
 */
export function nameLines(name: string): { lines: string[]; len: 1 | 2 | 3 } {
  const lines = name.split(' / ')
  // Measured roughly as drawn: "Sol" is no wider than "Re", for an l is narrow and a ♯ small.
  const width = (line: string) => [...line].reduce((w, c) => w + ('ilIjtfr'.includes(c) ? 0.5 : c === '♯' ? 0.6 : 1), 0)
  const widest = Math.max(...lines.map(width))
  return { lines, len: widest <= 1 ? 1 : widest <= 2.5 ? 2 : 3 }
}

/**
 * How much of each white key's column the black keys beside it cover, left
 * and right, in the same % as the boxes: a falling note on a white key keeps
 * its finger and name in the part a black key's note can't fall over.
 */
export function blackCover(boxes: readonly KeyBox[]): Map<number, { left: number; right: number }> {
  const blacks = boxes.filter((b) => b.black)
  const cover = new Map<number, { left: number; right: number }>()
  for (const b of boxes) {
    if (b.black) continue
    const end = b.left + b.width
    let left = 0
    let right = 0
    for (const k of blacks) {
      const kEnd = k.left + k.width
      if (k.left < b.left && kEnd > b.left) left = Math.max(left, kEnd - b.left)
      if (k.left < end && kEnd > end) right = Math.max(right, end - k.left)
    }
    cover.set(b.pitch, { left, right })
  }
  return cover
}
