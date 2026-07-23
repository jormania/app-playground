import { describe, it, expect } from 'vitest'
import { inferTagsFromSteamData, inferMatureTag } from './tagInference'

// This is the client-side twin of api/_lib/clickdeckTagInference.js — see
// that file's test for the full false-positive rationale; this just
// confirms the two copies actually agree on behavior.
describe('tagInference (client-side twin)', () => {
  it('passes through genres that match a real Click Deck tag, drops the rest', () => {
    const genres = [{ description: 'Adventure' }, { description: 'RPG' }, { description: 'Action' }]
    expect(inferTagsFromSteamData(genres, [])).toEqual(['Adventure', 'RPG'])
  })

  it('matches curated tags from description text', () => {
    const tags = inferTagsFromSteamData([], ['A noir detective mystery.'])
    expect(tags).toEqual(expect.arrayContaining(['Noir', 'Detective', 'Mystery']))
  })

  it('strips HTML before matching', () => {
    const tags = inferTagsFromSteamData([], ['<p>A <b>gothic</b> tale.</p>'])
    expect(tags).toContain('Gothic')
  })

  it('avoids the "cult classic" false positive, requires plural for Cults', () => {
    expect(inferTagsFromSteamData([], ['An instant cult classic.'])).not.toContain('Cults')
    expect(inferTagsFromSteamData([], ['A game about a dangerous cults.'])).toContain('Cults')
  })

  it('caps at 7 tags', () => {
    const text = ['noir detective mystery thriller horror supernatural cyberpunk dystopian fantasy gothic']
    expect(inferTagsFromSteamData([], text).length).toBeLessThanOrEqual(7)
  })

  it('returns empty rather than inventing tags when nothing matches', () => {
    expect(inferTagsFromSteamData([], ['A quiet walk.'])).toEqual([])
  })

  it('flags Mature from required_age, not text', () => {
    expect(inferMatureTag({ required_age: 18 })).toBe('Mature')
    expect(inferMatureTag({ required_age: 0 })).toBeNull()
  })
})
