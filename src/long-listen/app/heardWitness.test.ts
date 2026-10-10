import { describe, it, expect } from 'vitest'
import { Repo, memoryStore } from '../store/repo'
import { listeningState } from '../domain/listening'
import type { ListeningEvent, Recording } from '../domain/types'
import { recordHeardThrough } from './HeardWitness'

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
