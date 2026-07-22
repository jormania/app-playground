import { describe, it, expect } from 'vitest'
import { normalizeHltbTitle, findBestHltbMatch } from './hltbMatch'

describe('normalizeHltbTitle', () => {
  it('strips remaster/edition/anniversary suffixes so classics match their re-releases', () => {
    expect(normalizeHltbTitle('Grim Fandango Remastered')).toBe(normalizeHltbTitle('Grim Fandango'))
    expect(normalizeHltbTitle('Day of the Tentacle Remastered')).toBe(normalizeHltbTitle('Day of the Tentacle'))
    expect(normalizeHltbTitle('Disco Elysium - The Final Cut')).toBe(normalizeHltbTitle('Disco Elysium'))
  })

  it('normalizes leading "The" and ampersands', () => {
    expect(normalizeHltbTitle('The Secret of Monkey Island')).toBe(normalizeHltbTitle('Secret of Monkey Island'))
    expect(normalizeHltbTitle('Sam & Max Hit the Road')).toBe(normalizeHltbTitle('Sam and Max Hit the Road'))
  })
})

describe('findBestHltbMatch', () => {
  it('reports confident: true for a normalized exact match', () => {
    const items = [{ id: 4123, name: 'Grim Fandango', hours: 11.5 }]
    const { match, confident } = findBestHltbMatch(items, 'Grim Fandango')
    expect(match.id).toBe(4123)
    expect(confident).toBe(true)
  })

  it('reports confident: true for a legitimate edition-suffix re-release', () => {
    const items = [
      { id: 1, name: 'Something Else Entirely', hours: 5 },
      { id: 4123, name: 'Grim Fandango Remastered', hours: 11.5 }
    ]
    const { match, confident } = findBestHltbMatch(items, 'Grim Fandango')
    expect(match.id).toBe(4123)
    expect(confident).toBe(true)
  })

  it('reports confident: false when a short title only coincidentally overlaps a much longer name', () => {
    const items = [{ id: 1, name: 'Norcopolis Chronicles: Deluxe Edition', hours: 8 }]
    const { match, confident } = findBestHltbMatch(items, 'Norco')
    expect(match.id).toBe(1)
    expect(confident).toBe(false)
  })

  it('picks the exact match over an earlier coincidental substring hit, regardless of result order', () => {
    const items = [
      { id: 1, name: 'Digimon Survive', hours: 30 },
      { id: 6040, name: 'The Dig', hours: 7 }
    ]
    const { match, confident } = findBestHltbMatch(items, 'The Dig')
    expect(match.id).toBe(6040)
    expect(confident).toBe(true)
  })

  it('reports confident: false for an empty normalized title', () => {
    const items = [{ id: 1, name: 'Anything', hours: 1 }]
    const { match, confident } = findBestHltbMatch(items, '???')
    expect(match.id).toBe(1)
    expect(confident).toBe(false)
  })

  it('returns null match and confident: false for an empty result set', () => {
    expect(findBestHltbMatch([], 'Anything')).toEqual({ match: null, confident: false })
    expect(findBestHltbMatch(null, 'Anything')).toEqual({ match: null, confident: false })
  })
})
