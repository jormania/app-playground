import { test, expect, describe } from 'vitest'
import { inferTagsFromSteamData, inferMatureTag } from './clickdeckTagInference.js'

describe('inferTagsFromSteamData — genre passthrough', () => {
  test('passes through genres that match a real Click Deck tag', () => {
    const genres = [{ description: 'Adventure' }, { description: 'RPG' }, { description: 'Indie' }, { description: 'Casual' }]
    const tags = inferTagsFromSteamData(genres, [])
    expect(tags).toEqual(['Adventure', 'RPG', 'Indie', 'Casual'])
  })

  test('silently drops Steam genres with no ALL_TAGS equivalent rather than inventing one', () => {
    const genres = [{ description: 'Action' }, { description: 'Simulation' }, { description: 'Strategy' }]
    expect(inferTagsFromSteamData(genres, [])).toEqual([])
  })
})

describe('inferTagsFromSteamData — keyword matching from description text', () => {
  test('matches a specific curated tag from marketing copy, not just genres', () => {
    const tags = inferTagsFromSteamData([], ['A noir detective story set in a rain-soaked cyberpunk city.'])
    expect(tags).toEqual(expect.arrayContaining(['Noir', 'Detective', 'Cyberpunk']))
  })

  test('combines genre passthrough and keyword matches, deduped', () => {
    const genres = [{ description: 'Adventure' }, { description: 'Indie' }]
    const text = ['A charming point-and-click mystery with dark humor.']
    const tags = inferTagsFromSteamData(genres, text)
    expect(tags).toEqual(expect.arrayContaining(['Adventure', 'Indie', 'Point & Click', 'Mystery', 'Dark Humor', 'Cute']))
  })

  test('strips HTML before matching so tags in detailed_description markup still match', () => {
    const html = '<p>A <b>psychological horror</b> game about <i>time travel</i>.</p>'
    const tags = inferTagsFromSteamData([], [html])
    expect(tags).toEqual(expect.arrayContaining(['Psychological Horror', 'Time Travel']))
  })

  test('is case-insensitive', () => {
    expect(inferTagsFromSteamData([], ['A GOTHIC tale of SUPERNATURAL dread.'])).toEqual(
      expect.arrayContaining(['Gothic', 'Supernatural'])
    )
  })

  test('word-boundary matching avoids the "cult classic" false positive for Cults', () => {
    const tags = inferTagsFromSteamData([], ['An instant cult classic beloved by fans.'])
    expect(tags).not.toContain('Cults')
  })

  test('requires the plural "cults"/"cultists" to actually tag Cults', () => {
    const tags = inferTagsFromSteamData([], ['A story about escaping a dangerous cult and its cultists.'])
    expect(tags).toContain('Cults')
  })

  test('word-boundary matching avoids "difficult" false-firing Cults', () => {
    expect(inferTagsFromSteamData([], ['A difficult puzzle game.'])).not.toContain('Cults')
  })

  test('does not false-positive Automata from "available on Android"', () => {
    expect(inferTagsFromSteamData([], ['Available on Android and iOS.'])).not.toContain('Automata')
  })

  test('does not false-positive on generic short substrings ("art" inside "party", "ai" inside "again")', () => {
    const tags = inferTagsFromSteamData([], ['A party game you can play again and again with friends.'])
    expect(tags).not.toContain('Artificial Intelligence')
  })

  test('caps at 7 tags even when many keywords match', () => {
    const text = ['noir detective mystery thriller horror supernatural cyberpunk dystopian fantasy gothic']
    const tags = inferTagsFromSteamData([], text)
    expect(tags.length).toBeLessThanOrEqual(7)
  })

  test('returns an empty array (not padded/invented tags) when nothing matches', () => {
    expect(inferTagsFromSteamData([], ['A quiet little walk through the park.'])).toEqual([])
  })

  test('handles null/undefined genres and text gracefully', () => {
    expect(inferTagsFromSteamData(null, null)).toEqual([])
    expect(inferTagsFromSteamData(undefined, undefined)).toEqual([])
  })
})

describe('inferMatureTag', () => {
  test('flags Mature from required_age rather than guessing from text', () => {
    expect(inferMatureTag({ required_age: 18 })).toBe('Mature')
    expect(inferMatureTag({ required_age: '17' })).toBe('Mature')
  })

  test('does not flag Mature for a low or missing required_age', () => {
    expect(inferMatureTag({ required_age: 0 })).toBeNull()
    expect(inferMatureTag({})).toBeNull()
    expect(inferMatureTag(null)).toBeNull()
  })
})
