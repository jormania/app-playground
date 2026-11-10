import { describe, it, expect } from 'vitest'
import { GLOSSARY_TERMS, bakedDefinition } from './glossary'
import { ALIASES, DEFINITIONS_EN } from './glossaryDefinitions'

describe('the definitions the app keeps', () => {
  it('has one for every term on the list, and none for a term that isn’t', () => {
    expect(GLOSSARY_TERMS.filter((t) => !DEFINITIONS_EN[t] && !ALIASES[t])).toEqual([])
    expect(Object.keys(DEFINITIONS_EN).filter((t) => !GLOSSARY_TERMS.includes(t))).toEqual([])
  })

  it('defines a thing once: a second name has no definition of its own, and reads its thing’s', () => {
    expect(Object.keys(ALIASES).filter((a) => DEFINITIONS_EN[a])).toEqual([])
    expect(Object.values(ALIASES).filter((t) => !DEFINITIONS_EN[t])).toEqual([])
    expect(bakedDefinition('English horn', 'en')).toBe(DEFINITIONS_EN['cor anglais'])
  })

  it('keeps each to two sentences and about forty words, as the curator was asked to', () => {
    const long = Object.entries(DEFINITIONS_EN).filter(([, d]) => d.split(/\s+/).length > 45 || (d.match(/[.!?](\s|$)/g) ?? []).length > 2)
    expect(long.map(([t]) => t)).toEqual([])
  })

  it('finds a term however it was tapped, in English only', () => {
    expect(bakedDefinition('Col  Legno', 'en')).toBe(DEFINITIONS_EN['col legno'])
    expect(bakedDefinition('col legno', 'ro')).toBeUndefined()
  })
})
