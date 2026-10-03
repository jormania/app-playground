// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { SongNote } from '../../engine'
import { FallingNotes, PX_PER_MS } from './FallingNotes'
import { keyBoxes } from './keyGeometry'

afterEach(cleanup)

const note = (id: number, pitch: number, startMs: number, durationMs = 100): SongNote => ({ id, pitch, startMs, durationMs, hand: 'right', bar: 0, finger: 1 })
const boxes = keyBoxes(60, 72)
const names = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const draw = (notes: SongNote[], fingers = true) =>
  render(<FallingNotes notes={notes} boxes={boxes} results={new Map()} label={(p) => names[p % 12]} fingers={fingers} />).container
const heights = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('[style*="bottom"]')].map((n) => parseFloat(n.style.height))

describe('a short note with its finger', () => {
  it('grows tall enough for its finger over its name, keeps its name, and stays clear of the next note on its key', () => {
    // A sixteenth on C (18 px at this scale), then C again 150 ms on, then E with its key free above.
    const el = draw([note(0, 60, 0), note(1, 60, 150), note(2, 64, 0)])
    const [first, second, free] = heights(el)
    expect(free).toBe(42)
    expect(second).toBe(42)
    // Hemmed in: as tall as the gap allows, and never into the next note.
    expect(first).toBeLessThanOrEqual(150 * PX_PER_MS - 3)
    expect(first).toBeGreaterThan(18)
    // Every note keeps its name, beside the finger when it can't go under it.
    expect(el.textContent).toBe('1C1C1E')
  })

  it('without finger numbers, is drawn at its own length', () => {
    expect(heights(draw([note(0, 64, 0, 200)], false))).toEqual([200 * PX_PER_MS])
  })
})
