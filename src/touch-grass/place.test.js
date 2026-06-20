import { describe, it, expect } from 'vitest'
import { classify } from './place.js'

describe('classify (coarse biome)', () => {
  it('calls anything very high alpine, even over a town', () => {
    expect(classify({ city: 'Cuzco' }, 'place', 'city', 3400)).toBe('mountain')
  })

  it('reads coastal natural features as coast', () => {
    expect(classify({}, 'natural', 'beach', 5)).toBe('coast')
    expect(classify({}, 'natural', 'bay', 2)).toBe('coast')
  })

  it('reads woodland as forest', () => {
    expect(classify({}, 'natural', 'wood', 300)).toBe('forest')
    expect(classify({}, 'landuse', 'forest', 300)).toBe('forest')
  })

  it('reads peaks and ridges as mountain', () => {
    expect(classify({}, 'natural', 'peak', 700)).toBe('mountain')
  })

  it('reads a named city as city', () => {
    expect(classify({ city: 'Porto' }, 'place', 'city', 90)).toBe('city')
  })

  it('treats upland with no city as mountain', () => {
    expect(classify({ town: 'Davos' }, 'place', 'town', 1100)).toBe('mountain')
  })

  it('falls back to open ground', () => {
    expect(classify({ village: 'Somewhere' }, 'place', 'village', 120)).toBe('plain')
    expect(classify({}, undefined, undefined, null)).toBe('plain')
  })

  it('does not over-label a lowland town as city', () => {
    expect(classify({ town: 'Market Town' }, 'place', 'town', 50)).toBe('plain')
  })
})
