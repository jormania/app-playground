import { describe, it, expect } from 'vitest'
import { DEMO_GARMENTS, DEMO_OUTFITS } from './demoData.ts'
import { CATEGORIES, COLOURS, HOMES, MOODS, STYLES, VERDICTS, WARMTHS } from '../lib/vocabulary.ts'

// Fixtures are the first thing anyone sees, and they're also what the app is
// developed against. If they drift from the closed vocabulary, the demo looks
// fine while the same data would be rejected by Notion — the exact bug class
// vocabulary.ts exists to prevent. So the fixtures are held to the same rule.
describe('demo garments obey the closed vocabulary', () => {
  it.each(DEMO_GARMENTS)('$name', (g) => {
    expect(CATEGORIES).toContain(g.category)
    expect(WARMTHS).toContain(g.warmth)
    expect(HOMES).toContain(g.home)
    for (const c of g.colours) expect(COLOURS).toContain(c)
    for (const s of g.styles) expect(STYLES).toContain(s)
  })
})

describe('demo outfits obey the closed vocabulary', () => {
  it.each(DEMO_OUTFITS)('$name', (o) => {
    expect(MOODS).toContain(o.mood)
    expect(VERDICTS).toContain(o.verdict)
  })
})

describe('demo data is internally consistent', () => {
  it('has unique garment ids', () => {
    const ids = DEMO_GARMENTS.map((g) => g.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('only references garments that exist', () => {
    const ids = new Set(DEMO_GARMENTS.map((g) => g.id))
    for (const outfit of DEMO_OUTFITS) {
      for (const gid of outfit.garmentIds) expect(ids).toContain(gid)
    }
  })

  it('covers every category, so the wardrobe grid is never empty by section', () => {
    const seen = new Set(DEMO_GARMENTS.map((g) => g.category))
    for (const category of CATEGORIES) expect(seen).toContain(category)
  })

  it('spans both homes plus Both, so the home filter is exercised', () => {
    const seen = new Set(DEMO_GARMENTS.map((g) => g.home))
    for (const home of HOMES) expect(seen).toContain(home)
  })

  it('includes an archived garment, so the Active filter has something to hide', () => {
    expect(DEMO_GARMENTS.some((g) => !g.active)).toBe(true)
  })

  it('uses ISO dates throughout', () => {
    for (const g of DEMO_GARMENTS) {
      if (g.lastWorn) expect(g.lastWorn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
    for (const o of DEMO_OUTFITS) expect(o.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
