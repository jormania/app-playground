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
