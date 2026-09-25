import { describe, expect, it, vi } from 'vitest'
import type { LogRecord } from '../log'
import { memoryStore } from '../store'
import { askWeekly, checkWeekly, weekFacts, WeeklyRepo, withName } from './weekly'

const P = 'p1'
const on = (date: string, h = 18) => new Date(`${date}T${String(h).padStart(2, '0')}:00:00`).toISOString()
const records: LogRecord[] = [
  // The week before: one day.
  { type: 'session_start', at: on('2026-09-15'), profileId: P },
  { type: 'song_finished', songId: 'starter:ode', practice: 'right', stars: 2, score: 0.8, hit: 12, total: 15, wrong: 2, at: on('2026-09-15', 19), profileId: P },
  // This week: two days, Ode finished with three stars, Twinkle left unfinished, a check failed.
  { type: 'session_start', at: on('2026-09-20'), profileId: P },
  { type: 'door_opened', door: 'songs', at: on('2026-09-20'), profileId: P },
  { type: 'song_started', songId: 'starter:ode', practice: 'right', tempo: 1, mode: 'wait', at: on('2026-09-20'), profileId: P },
  { type: 'song_finished', songId: 'starter:ode', practice: 'right', stars: 3, score: 1, hit: 15, total: 15, wrong: 0, at: on('2026-09-20', 19), profileId: P },
  { type: 'session_start', at: on('2026-09-24'), profileId: P },
  { type: 'song_started', songId: 'starter:twinkle', practice: 'right', tempo: 1, mode: 'wait', at: on('2026-09-24'), profileId: P },
  { type: 'song_abandoned', songId: 'starter:twinkle', practice: 'right', hit: 4, total: 42, at: on('2026-09-24', 19), profileId: P },
  { type: 'journey_finished', step: 'fingers', mode: 'check', passed: false, wrong: 3, ms: 30000, at: on('2026-09-24', 19), profileId: P },
  { type: 'today_done', at: on('2026-09-24', 19), profileId: P },
]

describe('weekFacts', () => {
  it('counts the last seven days against the seven before, by title and never by name', () => {
    const f = weekFacts({
      records,
      today: '2026-09-25',
      title: (id) => ({ 'starter:ode': 'Ode to Joy', 'starter:twinkle': 'Twinkle' })[id] ?? id,
      stickers: new Map([
        ['firstSong', '2026-09-15'],
        ['threeStars', '2026-09-20'],
      ]),
      stickerName: (id) => (id === 'threeStars' ? 'Three stars' : 'First song'),
    })
    expect(f).toMatchObject({ from: '2026-09-19', to: '2026-09-25', daysPractised: 2, journeyChecksFailed: 1, todayCardsDone: 1, stickersEarned: ['Three stars'] })
    expect(f.songsFinished).toEqual([{ title: 'Ode to Joy', times: 1, bestStars: 3 }])
    expect(f.songsLeftUnfinished).toEqual([{ title: 'Twinkle', times: 1 }])
    expect(f.weekBefore).toMatchObject({ daysPractised: 1, songsFinished: 1 })
    expect(JSON.stringify(f)).not.toContain(P)
  })
})

describe('checkWeekly', () => {
  it('keeps {name} for the phone to fill, and drops anything with another placeholder or too long', () => {
    expect(checkWeekly('  {name} practised on two days.  ')).toBe('{name} practised on two days.')
    expect(withName('{name} practised; well done, {name}.', 'Nora')).toBe('Nora practised; well done, Nora.')
    expect(checkWeekly('{player} practised.')).toBeNull()
    expect(checkWeekly('x'.repeat(1300))).toBeNull()
    expect(checkWeekly('')).toBeNull()
  })
})

describe('askWeekly', () => {
  it('asks in the reader’s language, with the week’s facts, and returns the note', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ content: [{ type: 'text', text: '{name} practised on two days this week.' }], stop_reason: 'end_turn' }), { status: 200 }))
    const facts = weekFacts({ records, today: '2026-09-25', title: (id) => id, stickers: new Map(), stickerName: (id) => id })
    expect(await askWeekly('k', facts, 'ro', { fetchImpl })).toBe('{name} practised on two days this week.')
    const body = JSON.parse((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(body.system).toMatch(/Write in Romanian/)
    expect(body.system).toContain('{name}')
    expect(body.messages[0].content).toContain('"daysPractised":2')
  })
})

describe('WeeklyRepo', () => {
  it('keeps the last note per player', async () => {
    const repo = new WeeklyRepo(memoryStore())
    expect(await repo.get(P)).toBeNull()
    await repo.keep(P, { date: '2026-09-25', language: 'en', text: '{name} did well.' })
    expect(await repo.get(P)).toMatchObject({ text: '{name} did well.' })
  })
})
