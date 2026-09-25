import { describe, expect, it } from 'vitest'
import { songOf } from '../../engine/testing/songs'
import { STARTER_PACK, starterSong } from '../../engine/starterPack'
import { byLevel, levelOf, tryNext } from './level'

describe('song levels', () => {
  it('the starter pack says its own, and every song has one', () => {
    for (const s of STARTER_PACK) expect([1, 2, 3], s.id).toContain(levelOf(starterSong(s)))
    expect(levelOf(starterSong(STARTER_PACK.find((s) => s.id === 'starter:twinkle')!))).toBe(1)
    expect(levelOf(starterSong(STARTER_PACK.find((s) => s.id === 'starter:elise')!))).toBe(3)
  })

  it('an added song is judged from its notes', () => {
    // Five white keys, one a second: easy.
    expect(levelOf(songOf([60, 62, 64, 65, 67].map((p, i): [number, number] => [p, i * 1000])))).toBe(1)
    // Quick, wide, black keys, chords, both hands: hard.
    const busy: [number, number, 'left' | 'right'][] = []
    for (let i = 0; i < 40; i++) {
      busy.push([61 + (i % 3) * 12, i * 150, 'right'], [66 + (i % 2) * 12, i * 150, 'right'], [36, i * 150, 'left'])
    }
    expect(levelOf(songOf(busy))).toBe(3)
  })

  it('suggests the easiest song not finished yet, at this song’s level or above', () => {
    const entries = STARTER_PACK.map((s) => ({ song: starterSong(s) }))
    const done = new Set(['starter:twinkle', 'starter:ode'])
    expect(tryNext(entries, (id) => done.has(id), 'starter:ode')?.song.id).toBe('starter:lune')
    // From a level-2 song, the next level-2 one, not an easier one left behind.
    expect(tryNext(entries, (id) => done.has(id), 'starter:jacques')?.song.id).toBe('starter:london')
    // From the hardest, anything left.
    const allButBuns = new Set(entries.map((e) => e.song.id).filter((id) => id !== 'starter:buns'))
    expect(tryNext(entries, (id) => allButBuns.has(id), 'starter:elise')?.song.id).toBe('starter:buns')
    expect(tryNext(entries, () => true, 'starter:elise')).toBeNull()
  })

  it('sorts easiest first, keeping the order within a level', () => {
    const entries = STARTER_PACK.map((s) => ({ song: starterSong(s) }))
    const sorted = byLevel(entries).map((e) => levelOf(e.song))
    expect(sorted).toEqual([...sorted].sort())
    expect(byLevel(entries)[0].song.id).toBe('starter:twinkle')
  })
})
