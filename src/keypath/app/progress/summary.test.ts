import { describe, expect, it } from 'vitest'
import type { LogEvent, LogRecord } from '../log'
import { localDate, summarise } from './summary'

/** A log from events at local times. */
const log = (...entries: [string, LogEvent][]): LogRecord[] => entries.map(([at, e]) => ({ ...e, at: new Date(at).toISOString(), profileId: 'nora' }))

describe('summarise', () => {
  const records = log(
    // Monday evening: Songs first, then Studio.
    ['2026-09-21T18:00:00', { type: 'session_start' }],
    ['2026-09-21T18:01:00', { type: 'door_opened', door: 'songs' }],
    ['2026-09-21T18:02:00', { type: 'song_started', songId: 'starter:ode', practice: 'right', tempo: 1, mode: 'wait' }],
    ['2026-09-21T18:03:00', { type: 'song_finished', songId: 'starter:ode', practice: 'right', stars: 2, score: 0.8, hit: 12, total: 15, wrong: 1 }],
    ['2026-09-21T18:04:00', { type: 'suggestion', setting: 'onWrong', to: 'show', accepted: true, songId: 'starter:ode' }],
    ['2026-09-21T18:04:10', { type: 'setting_changed', key: 'onWrong', from: 'wait', to: 'show' }],
    ['2026-09-21T18:06:00', { type: 'song_started', songId: 'starter:ode', practice: 'right', tempo: 1, mode: 'running' }],
    ['2026-09-21T18:07:00', { type: 'song_finished', songId: 'starter:ode', practice: 'right', stars: 3, score: 1, hit: 15, total: 15, wrong: 0 }],
    ['2026-09-21T18:11:00', { type: 'door_opened', door: 'studio' }],
    ['2026-09-21T18:12:00', { type: 'studio_recorded', ms: 30000, notes: 40, style: true }],
    ['2026-09-21T18:12:30', { type: 'studio_kept', takeId: 't1' }],
    ['2026-09-21T18:15:00', { type: 'session_end', durationMs: 15 * 60000 }],
    // Tuesday: straight to Challenges, abandons a song.
    ['2026-09-22T17:00:00', { type: 'session_start' }],
    ['2026-09-22T17:00:30', { type: 'door_opened', door: 'challenges' }],
    ['2026-09-22T17:02:00', { type: 'challenge_finished', game: 'race', level: 1, score: 9, best: true, wrong: 2, ms: 30000 }],
    ['2026-09-22T17:05:30', { type: 'door_opened', door: 'songs' }],
    ['2026-09-22T17:06:00', { type: 'song_started', songId: 'starter:twinkle', practice: 'both', tempo: 0.75, mode: 'running' }],
    ['2026-09-22T17:07:00', { type: 'song_abandoned', songId: 'starter:twinkle', practice: 'both', hit: 4, total: 30 }],
    ['2026-09-22T17:08:00', { type: 'song_loop', songId: 'starter:twinkle', practice: 'both', bar: 5, passes: 3, done: true, tempo: 0.75 }],
    ['2026-09-22T17:09:00', { type: 'song_loop', songId: 'starter:twinkle', practice: 'both', bar: 7, passes: 1, done: false, tempo: 0.5 }],
    ['2026-09-22T17:10:30', { type: 'session_end', durationMs: 10.5 * 60000 }],
    // Thursday: a skipped day, then the Journey.
    ['2026-09-24T09:00:00', { type: 'session_start' }],
    ['2026-09-24T09:00:10', { type: 'door_opened', door: 'journey' }],
    ['2026-09-24T09:01:00', { type: 'journey_started', step: 'cde', mode: 'check', testOut: true }],
    ['2026-09-24T09:01:40', { type: 'journey_finished', step: 'cde', mode: 'check', passed: true, wrong: 0, ms: 40000 }],
    ['2026-09-24T09:02:00', { type: 'keyboard_lost', songId: 'x' }],
  )
  const s = summarise(records)

  it('counts sessions, time and the days she played, and whether she came back the next day', () => {
    expect(s).toMatchObject({ from: '2026-09-21', to: '2026-09-24', sessions: 3, minutes: 25.5 })
    expect(s.days).toEqual(['2026-09-21', '2026-09-22', '2026-09-24'])
    expect(s.cameBackNextDay).toBe(1) // Monday → Tuesday; Tuesday → Wednesday didn't happen
  })

  it('says which door she opens first, and roughly how long she stays', () => {
    expect(s.doors.songs).toEqual({ opens: 2, firstOpens: 1, minutes: 15 }) // 10 min Monday + 5 Tuesday
    expect(s.doors.studio).toEqual({ opens: 1, firstOpens: 0, minutes: 4 })
    expect(s.doors.challenges).toEqual({ opens: 1, firstOpens: 1, minutes: 5 })
    // Thursday's session is still open: counted up to its last event.
    expect(s.doors.journey).toEqual({ opens: 1, firstOpens: 1, minutes: 1.8 })
  })

  it('shows what she finishes and what she abandons, song by song', () => {
    expect(s.songs).toMatchObject({ started: 3, finished: 2, abandoned: 1, bars: { practised: 2, clean: 1 } })
    expect(s.songs.bySong).toEqual([
      { songId: 'starter:ode', started: 2, finished: 2, abandoned: 0, bestStars: 3 },
      { songId: 'starter:twinkle', started: 1, finished: 0, abandoned: 1, bestStars: null },
    ])
  })

  it('collects the rest of the doors, suggestions, setting changes and keyboard trouble', () => {
    expect(s.journey).toEqual({ practices: 0, checksPassed: 1, checksFailed: 0, testOuts: 1, left: 0 })
    expect(s.challenges).toEqual({ race: 1, staff: 0, echo: 0, chord: 0, left: 0 })
    expect(s.studio).toEqual({ opened: 0, recorded: 1, kept: 1, played: 0 })
    expect(s.suggestions).toEqual({ accepted: 1, declined: 0 })
    expect(s.settingsChanged).toEqual([{ key: 'onWrong', from: 'wait', to: 'show', at: new Date('2026-09-21T18:04:10').toISOString() }])
    expect(s.keyboard).toEqual({ setupsDone: 0, setupsLeft: 0, lostMidSong: 1 })
  })

  it('stops a door’s time when she is back on Home, rather than at the next door', () => {
    const t = summarise(
      log(
        ['2026-09-25T18:00:00', { type: 'session_start' }],
        ['2026-09-25T18:00:00', { type: 'door_opened', door: 'songs' }],
        ['2026-09-25T18:04:00', { type: 'door_left', door: 'songs' }],
        ['2026-09-25T18:10:00', { type: 'door_opened', door: 'journey' }],
        ['2026-09-25T18:12:00', { type: 'session_end', durationMs: 12 * 60000 }],
      ),
    )
    expect(t.doors.songs.minutes).toBe(4) // not 10: six minutes on Home between the doors
    expect(t.doors.journey.minutes).toBe(2)
  })

  it('is empty, not broken, for a player with no log yet', () => {
    expect(summarise([])).toMatchObject({ from: null, sessions: 0, days: [], cameBackNextDay: 0 })
  })

  it('dates events by the phone’s own calendar day', () => {
    expect(localDate(new Date('2026-09-24T23:30:00').toISOString())).toBe('2026-09-24')
  })
})
