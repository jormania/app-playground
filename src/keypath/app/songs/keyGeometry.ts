import { isBlackKey } from '../../midi/noteNames'

export interface KeyBox {
  pitch: number
  black: boolean
  /** Left edge and width as % of the keyboard's width. */
  left: number
  width: number
}

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
      const bw = w * 0.6
      boxes.push({ pitch: n, black: true, left: (index.get(n - 1)! + 1) * w - bw / 2, width: bw })
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
