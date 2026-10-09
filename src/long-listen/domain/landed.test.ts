import { describe, it, expect } from 'vitest'
import { nextToAsk } from './landed'
import type { Feedback, ListeningEvent, Programme } from './types'

const item = (id: string) => ({ id, workId: `w-${id}`, recordingId: `r-${id}`, why: '', whyThisRecording: '', listenFor: [], proposed: { composer: 'C', work: id, soloists: [] } })
const programme = { id: 'p', sections: [{ id: 's', role: 'start', heading: 'H', items: [item('a'), item('b')] }] } as unknown as Programme
const heard = (id: string, until: string, source = 'spotify-recent'): ListeningEvent => ({ id: `e-${id}-${until}`, at: until, kind: 'heard', recordingId: `r-${id}`, workId: `w-${id}`, source, playedUntil: until } as ListeningEvent)

describe('nextToAsk', () => {
  it('asks about the latest work Spotify heard and nobody has said anything about', () => {
    const events = [heard('a', '2026-10-08T20:00:00Z'), heard('b', '2026-10-09T20:00:00Z')]
    expect(nextToAsk(events, [], new Set(), [programme])?.item.id).toBe('b')
  })

  it('skips what was asked before, what has feedback, and what was marked by hand', () => {
    const events = [heard('a', '2026-10-08T20:00:00Z'), heard('b', '2026-10-09T20:00:00Z')]
    expect(nextToAsk(events, [], new Set(['r-b']), [programme])?.item.id).toBe('a')
    const fb = [{ id: 'f', at: 'x', target: { type: 'recording', id: 'r-b' }, reaction: 'liked' }] as Feedback[]
    expect(nextToAsk(events, fb, new Set(['r-a']), [programme])).toBeNull()
    expect(nextToAsk([heard('a', 'x', 'manual')], [], new Set(), [programme])).toBeNull()
  })
})
