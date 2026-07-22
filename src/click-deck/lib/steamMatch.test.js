import { describe, it, expect } from 'vitest'
import { normalizeSteamTitle, pickBestSteamMatch, findBestSteamMatch } from './steamMatch'

describe('normalizeSteamTitle', () => {
  it('strips remaster/edition/anniversary suffixes so classics match their re-releases', () => {
    expect(normalizeSteamTitle('Grim Fandango Remastered')).toBe(normalizeSteamTitle('Grim Fandango'))
    expect(normalizeSteamTitle('Day of the Tentacle Remastered')).toBe(normalizeSteamTitle('Day of the Tentacle'))
    expect(normalizeSteamTitle('Disco Elysium - The Final Cut')).toBe(normalizeSteamTitle('Disco Elysium'))
    expect(normalizeSteamTitle("Gabriel Knight: Sins of the Fathers (20th Anniversary Edition)"))
      .toBe(normalizeSteamTitle('Gabriel Knight: Sins of the Fathers'))
  })

  it('normalizes leading "The" and ampersands', () => {
    expect(normalizeSteamTitle('The Secret of Monkey Island')).toBe(normalizeSteamTitle('Secret of Monkey Island'))
    expect(normalizeSteamTitle('Sam & Max Hit the Road')).toBe(normalizeSteamTitle('Sam and Max Hit the Road'))
  })
})

describe('pickBestSteamMatch', () => {
  it('prefers a normalized-match candidate over an unrelated first result', () => {
    const items = [
      { id: 999, name: 'Some Unrelated Game' },
      { id: 355570, name: 'Grim Fandango Remastered' }
    ]
    expect(pickBestSteamMatch(items, 'Grim Fandango').id).toBe(355570)
  })

  it('falls back to the first result when nothing matches confidently', () => {
    const items = [{ id: 1, name: 'Totally Unrelated' }]
    expect(pickBestSteamMatch(items, 'Some Obscure Title').id).toBe(1)
  })

  it('returns null for an empty result set', () => {
    expect(pickBestSteamMatch([], 'Anything')).toBeNull()
    expect(pickBestSteamMatch(null, 'Anything')).toBeNull()
  })

  it('picks the exact match over an earlier coincidental substring hit, regardless of result order', () => {
    // A short, generic title ("The Dig") is a substring of plenty of unrelated
    // games — the old "first loose contains() hit wins" logic would have
    // locked onto the wrong one here since it comes first in the list.
    const items = [
      { id: 1, name: 'Digimon Survive' },
      { id: 6040, name: 'The Dig' }
    ]
    expect(pickBestSteamMatch(items, 'The Dig').id).toBe(6040)
  })
})

describe('findBestSteamMatch', () => {
  it('reports confident: true for a normalized exact match', () => {
    const items = [{ id: 32340, name: 'Loom' }]
    const { match, confident } = findBestSteamMatch(items, 'Loom')
    expect(match.id).toBe(32340)
    expect(confident).toBe(true)
  })

  it('reports confident: false when a short title only coincidentally overlaps a much longer name', () => {
    // "Norco" is fully contained in "Norcopolis Chronicles" but the two are
    // clearly different games — low overlap ratio should not read as a
    // verified match, so the caller can warn instead of trusting it blindly.
    const items = [{ id: 1, name: 'Norcopolis Chronicles: Deluxe Edition' }]
    const { match, confident } = findBestSteamMatch(items, 'Norco')
    expect(match.id).toBe(1)
    expect(confident).toBe(false)
  })

  it('reports confident: true for a legitimate edition-suffix re-release', () => {
    const items = [
      { id: 1, name: 'Something Else Entirely' },
      { id: 355570, name: 'Grim Fandango Remastered' }
    ]
    const { match, confident } = findBestSteamMatch(items, 'Grim Fandango')
    expect(match.id).toBe(355570)
    expect(confident).toBe(true)
  })

  it('reports confident: false for an empty normalized title', () => {
    const items = [{ id: 1, name: 'Anything' }]
    const { match, confident } = findBestSteamMatch(items, '???')
    expect(match.id).toBe(1)
    expect(confident).toBe(false)
  })

  it('returns null match and confident: false for an empty result set', () => {
    expect(findBestSteamMatch([], 'Anything')).toEqual({ match: null, confident: false })
    expect(findBestSteamMatch(null, 'Anything')).toEqual({ match: null, confident: false })
  })
})
