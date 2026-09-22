import { describe, it, expect } from 'vitest'
import { exercises, ACCENTS } from './exercises.js'
import { POSES } from './poses.jsx'

// Kettlebell's first tests (R-009). The item said to start with the state
// rather than the render tree — this app has no timer or session state, so the
// equivalent is its data module, which every screen is a direct projection of.
//
// These are invariants, not a transcription of the content. Rewording a step or
// adding a thirteenth exercise must not fail them; breaking the contract the
// render tree relies on must.

describe('the exercise list', () => {
  it('is non-empty and every entry carries the fields the cards read', () => {
    expect(exercises.length).toBeGreaterThan(0)
    for (const ex of exercises) {
      expect(typeof ex.id).toBe('string')
      expect(ex.id.length).toBeGreaterThan(0)
      expect(typeof ex.name).toBe('string')
      expect(typeof ex.tag).toBe('string')
      expect(typeof ex.tagline).toBe('string')
      expect(Array.isArray(ex.steps)).toBe(true)
      expect(ex.steps.length).toBeGreaterThan(0)
    }
  })

  it('has unique ids', () => {
    // App.jsx keys its cards `ex-${id}` and the scroll-spy reads that id back
    // off the element. A duplicate would make one nav chip unreachable and the
    // other highlight two cards.
    const ids = exercises.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('numbers them consecutively from 1, in list order', () => {
    // `num` is printed on the card; it is a position, not an identifier, so it
    // has to agree with the order the list is rendered in.
    expect(exercises.map((e) => e.num)).toEqual(exercises.map((_, i) => i + 1))
  })

  it('gives every exercise a difficulty the Difficulty component can draw', () => {
    // Difficulty renders one pip per level; anything outside 1–3 silently draws
    // the wrong number of them rather than failing.
    for (const ex of exercises) {
      expect(Number.isInteger(ex.difficulty)).toBe(true)
      expect(ex.difficulty).toBeGreaterThanOrEqual(1)
      expect(ex.difficulty).toBeLessThanOrEqual(3)
    }
  })

  it('accents every card with a colour from the ACCENTS palette', () => {
    // The cards are design-locked legacy; a one-off hex here is how that lock
    // erodes.
    const palette = new Set(Object.values(ACCENTS))
    for (const ex of exercises) {
      expect(palette.has(ex.accent)).toBe(true)
    }
  })
})

describe('the phase filmstrips', () => {
  it('names only poses the library actually draws', () => {
    // This is the one that matters. `phases[].pose` indexes POSES; a typo or a
    // pose that was renamed in poses.jsx renders an empty frame, and nothing in
    // the app complains.
    for (const ex of exercises) {
      for (const phase of ex.phases) {
        expect(Object.keys(POSES)).toContain(phase.pose)
      }
    }
  })

  it('captions every frame', () => {
    for (const ex of exercises) {
      expect(ex.phases.length).toBeGreaterThan(0)
      for (const phase of ex.phases) {
        expect(typeof phase.label).toBe('string')
        expect(phase.label.length).toBeGreaterThan(0)
      }
    }
  })

  it('only flips a pose that repeats within the same filmstrip', () => {
    // `flip` mirrors a repeated pose so it reads as a left/right rep. Flipping
    // a pose that appears once is not a left/right rep, it is a backwards
    // drawing.
    for (const ex of exercises) {
      const counts = {}
      for (const p of ex.phases) counts[p.pose] = (counts[p.pose] || 0) + 1
      for (const p of ex.phases) {
        if (p.flip) expect(counts[p.pose]).toBeGreaterThan(1)
      }
    }
  })
})
