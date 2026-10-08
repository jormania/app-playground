import { describe, it, expect } from 'vitest'
import { listeningState, latestFeedback, timesHeard } from './listening'
import type { Feedback, ListeningEvent } from './types'

const ev = (at: string, kind: ListeningEvent['kind'], source: ListeningEvent['source'] = 'manual'): ListeningEvent =>
  ({ id: at, at, kind, source, recordingId: 'r1', workId: 'w1' })

describe('listening state', () => {
  it('starts as not started and follows the listener’s own marks', () => {
    expect(listeningState([], 'r1')).toBe('not-started')
    expect(listeningState([ev('1', 'listening'), ev('2', 'heard')], 'r1')).toBe('heard')
    expect(listeningState([ev('1', 'heard'), ev('2', 'reset')], 'r1')).toBe('not-started')
    expect(listeningState([ev('1', 'skipped')], 'r1')).toBe('skipped')
  })

  it('lets Spotify move things forward but never undo the listener', () => {
    expect(listeningState([ev('1', 'partial', 'spotify-recent')], 'r1')).toBe('listening')
    expect(listeningState([ev('1', 'heard'), ev('2', 'partial', 'spotify-recent')], 'r1')).toBe('heard')
    expect(listeningState([ev('1', 'heard', 'spotify-recent'), ev('2', 'skipped')], 'r1')).toBe('skipped')
    expect(listeningState([ev('1', 'skipped'), ev('2', 'heard', 'spotify-recent')], 'r1')).toBe('heard')
  })

  it('opening a recording in Spotify counts as listening, not hearing', () => {
    expect(listeningState([ev('1', 'opened', 'app')], 'r1')).toBe('listening')
  })

  it('counts separate hearings for the curator, never for display', () => {
    expect(timesHeard([ev('1', 'heard'), ev('2', 'heard', 'spotify-recent')], 'r1')).toBe(2)
  })
})

describe('feedback', () => {
  it('keeps the latest reaction and every note', () => {
    const fb = (at: string, extra: Partial<Feedback>): Feedback => ({ id: at, at, target: { type: 'recording', id: 'r1' }, ...extra })
    expect(latestFeedback([
      fb('1', { reaction: 'interesting', note: 'Odd but compelling.' }),
      fb('2', { reaction: 'loved', more: 'yes', note: 'Second time it clicked.' }),
      { id: 'x', at: '3', target: { type: 'recording', id: 'other' }, reaction: 'not-for-me' },
    ], 'r1')).toEqual({ reaction: 'loved', more: 'yes', notes: ['Odd but compelling.', 'Second time it clicked.'] })
  })
})
