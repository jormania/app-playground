import { describe, expect, it } from 'vitest'
import { STARTER_PACK, starterSong } from '../../engine/starterPack'
import type { LogEvent, LogRecord } from '../log'
import { memoryStore } from '../store'
import { isDone, planToday, todayFor } from './today'

const songs = STARTER_PACK.map((s) => ({ song: starterSong(s) }))
const at = (day: string, e: LogEvent): LogRecord => ({ ...e, at: new Date(`${day}T10:00:00`).toISOString(), profileId: 'p' }) as LogRecord

describe('Today', () => {
  it('for a new player: the easiest song, the first step, and a game', () => {
    const plan = planToday([], {}, songs, '2026-09-25')
    expect(plan.items[0]).toEqual({ kind: 'song', songId: 'starter:twinkle' })
    expect(plan.items[1]).toEqual({ kind: 'journey', step: 'middleC' })
    expect(plan.items[2].kind).toBe('game')
  })

  it('keeps the song she’s on until it has three stars, then moves to the next one not finished', () => {
    const on = [at('2026-09-24', { type: 'song_finished', songId: 'starter:ode', practice: 'right', stars: 2, score: 0.8, hit: 8, total: 10, wrong: 1 })]
    expect(planToday(on, {}, songs, '2026-09-25').items[0]).toEqual({ kind: 'song', songId: 'starter:ode' })
    const done = [...on, at('2026-09-24', { type: 'song_finished', songId: 'starter:ode', practice: 'right', stars: 3, score: 1, hit: 10, total: 10, wrong: 0 })]
    expect(planToday(done, {}, songs, '2026-09-25').items[0]).toEqual({ kind: 'song', songId: 'starter:twinkle' })
  })

  it('offers the first Journey step not done, and none once the Journey is done', () => {
    expect(planToday([], { middleC: { at: '', how: 'check' } }, songs, '2026-09-25').items[1]).toEqual({ kind: 'journey', step: 'fingers' })
    const all = Object.fromEntries(['middleC', 'fingers', 'cde', 'fiveFinger', 'chord', 'twoHands', 'notation', 'leftHand', 'blackKeys', 'readingHigher'].map((id) => [id, { at: '', how: 'check' as const }]))
    expect(planToday([], all, songs, '2026-09-25').items.map((i) => i.kind)).toEqual(['song', 'game'])
  })

  it('picks the game she has played least, taking turns day by day between equals', () => {
    const races = [1, 2].map(() => at('2026-09-20', { type: 'challenge_finished', game: 'staff', level: 1, score: 5, best: false, ms: 1 }))
    const echo = at('2026-09-20', { type: 'challenge_finished', game: 'echo', level: 1, score: 5, best: false, ms: 1 })
    expect(planToday([...races, echo], {}, songs, '2026-09-25').items.at(-1)).toEqual({ kind: 'game', game: 'chord' })
    const games = new Set(['2026-09-25', '2026-09-26', '2026-09-27'].map((d) => JSON.stringify(planToday([], {}, songs, d).items.at(-1))))
    expect(games.size).toBe(3)
  })

  it('ticks each off from today’s log only', () => {
    const today = '2026-09-25'
    const song = { kind: 'song' as const, songId: 'starter:ode' }
    expect(isDone(song, [at('2026-09-24', { type: 'song_finished', songId: 'starter:ode', practice: 'right', stars: 1, score: 0.5, hit: 5, total: 10, wrong: 3 })], today)).toBe(false)
    expect(isDone(song, [at(today, { type: 'song_part', songId: 'starter:ode', practice: 'right', part: 'p1', passed: true, wrong: 0 })], today)).toBe(true)
    expect(isDone(song, [at(today, { type: 'song_part', songId: 'starter:ode', practice: 'right', part: 'p1', passed: false, wrong: 5 })], today)).toBe(false)
    const step = { kind: 'journey' as const, step: 'cde' as const }
    expect(isDone(step, [at(today, { type: 'journey_finished', step: 'cde', mode: 'practice', passed: true, wrong: 0, ms: 1 })], today)).toBe(true)
    expect(isDone(step, [at(today, { type: 'journey_finished', step: 'cde', mode: 'check', passed: false, wrong: 4, ms: 1 })], today)).toBe(false)
    const game = { kind: 'game' as const, game: 'race' as const }
    expect(isDone(game, [at(today, { type: 'challenge_finished', game: 'staff', level: 1, score: 3, best: false, ms: 1 })], today)).toBe(true)
  })

  it('keeps the day’s picks for the day, and makes new ones the next', async () => {
    const store = memoryStore()
    let made = 0
    const make = (date: string) => () => (made++, planToday([], {}, songs, date))
    const a = await todayFor(store, 'p', make('2026-09-25'), '2026-09-25')
    const b = await todayFor(store, 'p', make('2026-09-25'), '2026-09-25')
    expect(b).toEqual(a)
    expect(made).toBe(1)
    await todayFor(store, 'p', make('2026-09-26'), '2026-09-26')
    expect(made).toBe(2)
  })
})
