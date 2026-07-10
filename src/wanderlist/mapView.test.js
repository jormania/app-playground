import { test, expect, describe } from 'vitest'
import { mapEntries, embedSrc } from './mapView.js'

describe('mapEntries', () => {
  const today = '2026-07-09'
  const entries = [
    { id: 'a', place: 'Cinema Pro', dateExpiring: '2026-07-20' },
    { id: 'b', place: '', dateExpiring: '2026-07-10' },          // no place -> excluded
    { id: 'c', place: 'MNAR', dateExpiring: '2026-07-11' },       // soonest expiry -> leads
    { id: 'd', place: '   ', dateExpiring: null },                // whitespace place -> excluded
    { id: 'e', place: 'Uranus', dateExpiring: null },             // no expiry -> middle/after dated
  ]
  test('keeps only entries with a real place, Expiring-first (soonest leads)', () => {
    const out = mapEntries(entries, today)
    expect(out.map(e => e.id)).toEqual(['c', 'a', 'e'])
  })
  test('empty / missing input -> []', () => {
    expect(mapEntries([], today)).toEqual([])
    expect(mapEntries(undefined, today)).toEqual([])
  })
})

describe('embedSrc', () => {
  test('an address-shaped place (has a comma) is used as-is', () => {
    expect(embedSrc({ place: 'Cinema Pro, București' }))
      .toBe('https://maps.google.com/maps?q=Cinema%20Pro%2C%20Bucure%C8%99ti&z=14&output=embed')
  })
  test('a bare name (no comma) gets the city appended so Google pins it', () => {
    // Without the city, Google's keyless embed often centres but drops no pin.
    expect(embedSrc({ place: 'ARCUB - Hanul Gabroveni' }))
      .toBe('https://maps.google.com/maps?q=ARCUB%20-%20Hanul%20Gabroveni%2C%20Bucure%C8%99ti&z=14&output=embed')
  })
  test('honours a custom zoom', () => {
    expect(embedSrc({ place: 'X' }, { zoom: 11 })).toContain('&z=11&')
  })
  test('no place -> empty string', () => {
    expect(embedSrc({ place: '' })).toBe('')
    expect(embedSrc({})).toBe('')
    expect(embedSrc(null)).toBe('')
  })
})
