import { describe, expect, it } from 'vitest'
import type { LogEvent, LogRecord } from '../log'
import { memoryStore } from '../store'
import { earnedStickers, markSeen, seenStickers, STICKERS } from './stickers'

const at = (day: string, e: LogEvent): LogRecord => ({ ...e, at: new Date(`${day}T10:00:00`).toISOString(), profileId: 'p' }) as LogRecord

describe('stickers', () => {
  it('none for a new player, and each earned by its first', () => {
    expect(earnedStickers([]).size).toBe(0)
    const r = [
      at('2026-09-20', { type: 'song_finished', songId: 'x', practice: 'right', stars: 2, score: 0.8, hit: 8, total: 10, wrong: 1 }),
      at('2026-09-21', { type: 'song_finished', songId: 'x', practice: 'right', stars: 3, score: 1, hit: 10, total: 10, wrong: 0 }),
      at('2026-09-21', { type: 'journey_finished', step: 'fingers', mode: 'check', passed: true, wrong: 1, ms: 1 }),
      at('2026-09-22', { type: 'song_loop', songId: 'x', practice: 'right', bar: 2, passes: 3, done: true, tempo: 1 }),
    ]
    const earned = earnedStickers(r)
    expect(earned.get('firstSong')).toBe('2026-09-20')
    expect(earned.get('threeStars')).toBe('2026-09-21')
    expect(earned.get('fingers')).toBe('2026-09-21')
    expect(earned.get('cleanBar')).toBe('2026-09-22')
    // One wrong key: passed, but not the clean-step sticker.
    expect(earned.has('cleanStep')).toBe(false)
  })

  it('a week of practice days: seven days she played, not necessarily in a row', () => {
    const days = ['2026-09-01', '2026-09-03', '2026-09-04', '2026-09-08', '2026-09-10', '2026-09-11']
    const r = days.map((d) => at(d, { type: 'song_started', songId: 'x', practice: 'right', tempo: 1, mode: 'wait' }))
    expect(earnedStickers(r).has('week')).toBe(false)
    r.push(at('2026-09-11', { type: 'journey_started', step: 'cde', mode: 'check', testOut: false }))
    expect(earnedStickers(r).has('week')).toBe(false)
    r.push(at('2026-09-15', { type: 'challenge_started', game: 'echo', level: 1 }))
    expect(earnedStickers(r).get('week')).toBe('2026-09-15')
  })

  it('every sticker has its own id and a way to earn it', () => {
    expect(new Set(STICKERS.map((s) => s.id)).size).toBe(STICKERS.length)
    for (const s of STICKERS) expect(!!s.earns || s.id === 'week', s.id).toBe(true)
  })

  it('remembers which have been shown, per player', async () => {
    const store = memoryStore()
    await markSeen(store, 'nora', ['firstSong'])
    await markSeen(store, 'nora', ['threeStars', 'firstSong'])
    expect(await seenStickers(store, 'nora')).toEqual(new Set(['firstSong', 'threeStars']))
    expect(await seenStickers(store, 'gabriel')).toEqual(new Set())
  })
})
