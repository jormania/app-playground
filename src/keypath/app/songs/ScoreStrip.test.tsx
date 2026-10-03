// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Hand, SongNote } from '../../engine'
import { ledgerSteps, ScoreStrip, stepOf } from './ScoreStrip'

afterEach(cleanup)

let id = 0
const n = (pitch: number, startMs: number, bar: number, hand: Hand = 'right', durationMs = 450): SongNote => ({ id: id++, pitch, startMs, durationMs, hand, bar })

describe('stepOf', () => {
  it('counts white keys from middle C, and puts a black key on the white key below', () => {
    expect([60, 62, 64, 65, 67, 69, 71, 72].map(stepOf)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    expect(stepOf(61)).toBe(0) // C♯ sits on C
    expect(stepOf(48)).toBe(-7) // C3
    expect(stepOf(79)).toBe(11) // G5
  })
})

describe('ledgerSteps', () => {
  it('draws the lines a note needs beyond the staff, and none inside it', () => {
    expect(ledgerSteps(2, 'treble')).toEqual([]) // E4, the bottom line
    expect(ledgerSteps(0, 'treble')).toEqual([0]) // middle C
    expect(ledgerSteps(-2, 'treble')).toEqual([0, -2])
    expect(ledgerSteps(12, 'treble')).toEqual([12]) // A5
    expect(ledgerSteps(0, 'bass')).toEqual([0]) // middle C from below
    expect(ledgerSteps(-12, 'bass')).toEqual([-12]) // E2
    expect(ledgerSteps(-6, 'bass')).toEqual([])
  })
})

describe('ScoreStrip', () => {
  const notes = [n(64, 0, 0), n(66, 500, 0), n(67, 1000, 0), n(48, 0, 0, 'left', 1800), n(72, 2000, 1), n(45, 2000, 1, 'left')]
  const draw = (practice: 'right' | 'left' | 'both', bar = 0, now: number[] = []) =>
    render(<ScoreStrip notes={notes} practice={practice} bar={bar} now={new Set(now)} results={new Map()} beatMs={500} ariaLabel="The music" />).container.querySelector('svg')!

  it('shows a staff for each hand practised, and both for both', () => {
    expect(draw('right').querySelectorAll('ellipse')).toHaveLength(4) // three notes in bar 1, one in bar 2
    cleanup()
    expect(draw('left').querySelectorAll('ellipse')).toHaveLength(2)
    cleanup()
    expect(draw('both').querySelectorAll('ellipse')).toHaveLength(6)
  })

  it('marks a black key with a sharp, and the notes to play now', () => {
    const svg = draw('right', 0, [notes[2].id])
    expect(svg.textContent).toContain('♯')
    expect(svg.querySelectorAll('g[class*="scoreNow"]')).toHaveLength(1)
  })

  it('marks only the notes it is told are now, not every note on the same key', () => {
    const repeated = [n(64, 0, 0), n(64, 500, 0), n(64, 1000, 0)]
    const svg = render(<ScoreStrip notes={repeated} practice="right" bar={0} now={new Set([repeated[1].id])} results={new Map([[repeated[0].id, 'hit' as const]])} beatMs={500} ariaLabel="x" />).container.querySelector('svg')!
    expect([...svg.querySelectorAll('g[class*="scoreNote"]')].map((g) => /scoreNow/.test(g.getAttribute('class')!))).toEqual([false, true, false])
  })

  it('writes a natural on a white key after a sharp on its line in the same bar, and not in the next', () => {
    const line = [n(61, 0, 0), n(60, 500, 0), n(60, 1000, 0), n(61, 2000, 1), n(60, 2500, 1)]
    const marks = (bar: number) =>
      [...render(<ScoreStrip notes={line} practice="right" bar={bar} now={new Set()} results={new Map()} beatMs={500} ariaLabel="x" />).container.querySelectorAll('text')].map((t) => t.textContent)
    expect(marks(0)).toEqual(['♯', '♮', '♯', '♮'])
  })

  it('grows to keep a note far above the staff in view, and writes a wrong key in red beside the note to play', () => {
    const high = [n(60, 0, 0), n(96, 500, 0)]
    const svg = render(<ScoreStrip notes={high} practice="right" bar={0} now={new Set([high[0].id])} results={new Map()} beatMs={500} ariaLabel="x" wrong={new Set([62])} />).container.querySelector('svg')!
    const top = Number(svg.getAttribute('viewBox')!.split(' ')[1])
    expect(top).toBeLessThan(-6)
    expect(svg.querySelector('[data-wrong="62"]')).toBeTruthy()
  })

  it('is described for a screen reader, and shows the bars it is given', () => {
    expect(draw('right', 1).getAttribute('aria-label')).toBe('The music')
    cleanup()
    // Bar 2 first: only its one note, and the empty bar after it.
    expect(draw('right', 1).querySelectorAll('ellipse')).toHaveLength(1)
  })
})
