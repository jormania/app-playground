import { describe, expect, it } from 'vitest'
import { Repo, memoryStore } from '../store/repo'
import { beforeReject, rejectMatch, undoReject } from './verify'
import type { ListeningEvent, Recording } from '../domain/types'

describe('"not this recording", taken back', () => {
  it('puts the match and the Spotify listening it forgot back exactly as they were', async () => {
    const repo = new Repo(memoryStore())
    const rec: Recording = {
      id: 'rec_1', workId: 'w', soloistIds: [], character: [], verification: 'verified', albumId: 'alb',
      spotify: { albumId: 'alb', albumName: 'The Essential Rautavaara', albumUri: 'u', artistNames: [], trackIds: ['t1'], trackUris: ['u1'], confidence: 'strong', matchedAt: '2026-10-01T00:00:00Z' },
    }
    const heard: ListeningEvent = { id: 'e1', at: '2026-10-02T00:00:00Z', kind: 'heard', recordingId: 'rec_1', workId: 'w', source: 'spotify-recent', playedAt: '2026-10-01T20:00:00Z' }
    await repo.recordings.put(rec)
    await repo.events.put(heard)
    const was = await beforeReject(repo, 'rec_1')
    await rejectMatch(repo, null, 'rec_1', { composer: 'Rautavaara', work: 'Cantus arcticus', soloists: [] })
    expect((await repo.recordings.get('rec_1'))?.spotify).toBeUndefined()
    expect(await repo.events.all()).toEqual([])
    await undoReject(repo, was)
    expect(await repo.recordings.get('rec_1')).toEqual(rec)
    expect(await repo.events.all()).toEqual([heard])
  })
})
