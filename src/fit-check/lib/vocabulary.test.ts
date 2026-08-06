import { describe, it, expect } from 'vitest'
import {
  CATEGORIES, COLOURS, STYLES, WARMTHS, HOMES, MOODS,
  isKnown, coerceOne, coerceMany, vocabularyForPrompt,
} from './vocabulary.ts'

describe('isKnown', () => {
  it('accepts a registered option', () => expect(isKnown(CATEGORIES, 'Top')).toBe(true))
  it('rejects an unregistered one', () => expect(isKnown(CATEGORIES, 'Blouse')).toBe(false))
  it('rejects non-strings', () => {
    expect(isKnown(CATEGORIES, null)).toBe(false)
    expect(isKnown(CATEGORIES, 42)).toBe(false)
  })
})

describe('coerceOne', () => {
  it('passes a registered option through', () => expect(coerceOne(CATEGORIES, 'Shoes')).toBe('Shoes'))
  it('rescues a casing variant', () => {
    expect(coerceOne(STYLES, 'Casual')).toBe('casual')
    expect(coerceOne(WARMTHS, 'warm')).toBe('Warm')
  })
  it('trims incidental whitespace', () => expect(coerceOne(CATEGORIES, '  Top ')).toBe('Top'))
  it('returns null rather than guessing a default', () => {
    // The point: an unrecognised answer leaves the property UNSET so Nora can
    // fix it. Silently defaulting to CATEGORIES[0] would hide the mistake.
    expect(coerceOne(CATEGORIES, 'Blouse')).toBe(null)
    expect(coerceOne(COLOURS, 'dusty rose')).toBe(null)
  })
})

describe('coerceMany', () => {
  it('keeps registered options and drops the rest', () => {
    expect(coerceMany(COLOURS, ['navy', 'dusty rose', 'cream'])).toEqual(['navy', 'cream'])
  })
  it('de-duplicates, including across casing', () => {
    expect(coerceMany(STYLES, ['casual', 'Casual', 'casual'])).toEqual(['casual'])
  })
  it('returns an empty array for a non-array', () => {
    expect(coerceMany(COLOURS, 'navy')).toEqual([])
    expect(coerceMany(COLOURS, null)).toEqual([])
  })
  it('survives a model returning objects instead of strings', () => {
    expect(coerceMany(COLOURS, [{ name: 'navy' }, 'cream'])).toEqual(['cream'])
  })
})

describe('the guarantee this module exists for', () => {
  // If this ever fails, a Notion write can carry an unregistered option, and
  // Notion rejects the WHOLE patch — unrelated fields fail silently with it.
  it('never emits a value Notion has not registered', () => {
    const hostile = [
      'dusty rose', 'cottagecore', '', '   ', 'Top; DROP', '<script>', 'null',
      'Tops', 'top-ish', '0', 'undefined',
    ]
    for (const lists of [CATEGORIES, COLOURS, STYLES, WARMTHS, HOMES, MOODS]) {
      for (const value of hostile) {
        const one = coerceOne(lists, value)
        expect(one === null || (lists as readonly string[]).includes(one)).toBe(true)
      }
      for (const kept of coerceMany(lists, hostile)) {
        expect(lists as readonly string[]).toContain(kept)
      }
    }
  })
})

describe('vocabularyForPrompt', () => {
  it('is generated from the same lists the validators use', () => {
    const prompt = vocabularyForPrompt()
    // Drift between prompt and validator is the failure mode this prevents.
    for (const c of CATEGORIES) expect(prompt).toContain(c)
    for (const c of COLOURS) expect(prompt).toContain(c)
    for (const s of STYLES) expect(prompt).toContain(s)
  })
})
