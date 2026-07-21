import { describe, it, expect } from 'vitest'
import { normalizeSteamTitle, pickBestSteamMatch } from './steamMatch'

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
})
