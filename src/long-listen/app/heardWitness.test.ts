import { describe, it, expect } from 'vitest'
import { Repo, memoryStore } from '../store/repo'
import { listeningState } from '../domain/listening'
import type { ListeningEvent, Recording } from '../domain/types'
import { recordHeardThrough, stoppedWorks } from './HeardWitness'
import { positionOf } from './playback'
import type { NowPlaying } from '../spotify/client'

const rec = (id: string, trackIds: string[], verification: Recording['verification'] = 'verified'): Recording => ({
  id, workId: `w-${id}`, soloistIds: [], character: [], verification,
  spotify: { albumId: 'a', albumName: 'A', albumUri: 'spotify:album:a', artistNames: [], trackIds, trackUris: trackIds.map((t) => `spotify:track:${t}`), confidence: 'strong', matchedAt: '2026-10-10T08:00:00Z' },
})

describe('recording a work the app watched play end to end', () => {
  it('marks every confirmed single-track recording of the track heard — the app’s word — and nothing else', async () => {
    const repo = new Repo(memoryStore())
    await repo.recordings.putMany([
      rec('tintagel', ['t1']),
      rec('tintagel-again', ['t1']),
      rec('symphony', ['t1', 't2', 't3']),
      rec('unconfirmed', ['t1'], 'unconfirmed'),
      rec('other', ['t9']),
    ])
    const events: ListeningEvent[] = []
    const journey = {
      markListening: async (item: { recordingId: string; workId: string }, kind: ListeningEvent['kind'], programmeId?: string, source: ListeningEvent['source'] = 'manual') => {
        const e: ListeningEvent = { id: `e${events.length}`, at: '2026-10-10T08:20:00Z', kind, recordingId: item.recordingId, workId: item.workId, programmeId, source }
        events.push(e)
        return e
      },
    }
    expect(await recordHeardThrough(repo, journey, ['t1'])).toEqual(['tintagel', 'tintagel-again'])
    expect(events.map((e) => [e.recordingId, e.kind, e.source])).toEqual([['tintagel', 'heard', 'app'], ['tintagel-again', 'heard', 'app']])
    expect(listeningState(events, 'tintagel')).toBe('heard')
  })

  it('never overrules the listener: a later manual mark still wins', () => {
    const events: ListeningEvent[] = [
      { id: 'a', at: '2026-10-10T08:20:00Z', kind: 'heard', recordingId: 'r', workId: 'w', source: 'app' },
      { id: 'b', at: '2026-10-10T08:25:00Z', kind: 'reset', recordingId: 'r', workId: 'w', source: 'manual' },
    ]
    expect(listeningState(events, 'r')).toBe('not-started')
  })
})

const np = (trackId: string, isPlaying: boolean, progressMs = 60_000, durationMs = 300_000): NowPlaying =>
  ({ trackId, trackName: '', isPlaying, progressMs, durationMs })

describe('a work in movements that stops', () => {
  const serenade = rec('serenade', ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'])
  const all = [serenade, rec('tintagel', ['m6']), rec('unconfirmed', ['m1', 'm2'], 'unconfirmed')]

  it('is noticed when Spotify plays the list out and goes back to the first movement, paused', () => {
    expect(stoppedWorks(np('m6', true, 290_000), np('m1', false, 0), all).map((r) => r.id)).toEqual(['serenade'])
  })

  it('is noticed when paused, stopped, or left for something else — not when it moves to its next movement', () => {
    expect(stoppedWorks(np('m3', true), np('m3', false), all).map((r) => r.id)).toEqual(['serenade'])
    expect(stoppedWorks(np('m3', true), null, all).map((r) => r.id)).toEqual(['serenade'])
    expect(stoppedWorks(np('m3', true), np('other', true), all).map((r) => r.id)).toEqual(['serenade'])
    expect(stoppedWorks(np('m3', true), np('m4', true), all)).toEqual([])
    expect(stoppedWorks(np('m3', false), np('m3', false), all)).toEqual([])
  })
})

describe('where a recording stands on Spotify', () => {
  const ids = ['m1', 'm2', 'm3']
  it('a list played out, back on the first movement at 0:00 and paused, is at rest: Play, not Resume', () => {
    expect(positionOf(np('m1', false, 0), ids)).toBeNull()
  })
  it('stopped on the last movement, at its close or its start, is at rest', () => {
    expect(positionOf(np('m3', false, 298_000), ids)).toBeNull()
    expect(positionOf(np('m3', false, 0), ids)).toBeNull()
  })
  it('paused partway is a place to resume from; playing is playing', () => {
    expect(positionOf(np('m1', false, 45_000), ids)).toEqual({ index: 0, playing: false })
    expect(positionOf(np('m2', false, 0), ids)).toEqual({ index: 1, playing: false })
    expect(positionOf(np('m1', true, 0), ids)).toEqual({ index: 0, playing: true })
    expect(positionOf(np('x', false, 0), ids)).toBeNull()
  })
})
