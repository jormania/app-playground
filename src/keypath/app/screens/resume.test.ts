import { describe, expect, it } from 'vitest'
import type { LogEvent, LogRecord } from '../log'
import { resumeFrom } from './resume'

const log = (...events: LogEvent[]): LogRecord[] => events.map((e, i) => ({ ...e, at: new Date(2026, 8, 1, 10, i).toISOString(), profileId: 'n' }))

describe('resumeFrom', () => {
  it('picks the last song, with the best stars she has on it', () => {
    const r = log(
      { type: 'song_finished', songId: 'starter:ode', practice: 'right', stars: 3, score: 1, hit: 1, total: 1, wrong: 0 },
      { type: 'song_started', songId: 'starter:twinkle', practice: 'right', tempo: 1, mode: 'wait' },
      { type: 'song_finished', songId: 'starter:twinkle', practice: 'right', stars: 2, score: 0.8, hit: 1, total: 1, wrong: 0 },
      { type: 'song_abandoned', songId: 'starter:twinkle', practice: 'both', hit: 1, total: 9 },
    )
    expect(resumeFrom(r)).toEqual({ kind: 'song', songId: 'starter:twinkle', bestStars: 2 })
  })

  it('points on to the next Journey step after a passed check, and stays on a step not yet passed', () => {
    expect(resumeFrom(log({ type: 'journey_finished', step: 'cde', mode: 'check', passed: true, wrong: 0, ms: 1 }))).toEqual({ kind: 'journey', step: 'fiveFinger' })
    expect(resumeFrom(log({ type: 'journey_finished', step: 'cde', mode: 'check', passed: false, wrong: 3, ms: 1 }))).toEqual({ kind: 'journey', step: 'cde' })
    expect(resumeFrom(log({ type: 'journey_finished', step: 'notation', mode: 'check', passed: true, wrong: 0, ms: 1 }))).toBeNull()
  })

  it('has nothing to offer on a first visit', () => {
    expect(resumeFrom(log({ type: 'session_start' }, { type: 'door_opened', door: 'studio' }))).toBeNull()
  })
})
