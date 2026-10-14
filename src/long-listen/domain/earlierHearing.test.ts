import { describe, expect, it } from 'vitest'
import type { Concert, Feedback, ListeningEvent } from './types'
import { earlierHearing, onDay, shortNote } from './earlierHearing'

const ev = (over: Partial<ListeningEvent>): ListeningEvent => ({ id: Math.random().toString(36), at: '2026-09-02T19:00:00Z', kind: 'heard', recordingId: 'rec_a', workId: 'w_mer', source: 'manual', ...over })
const fb = (over: Partial<Feedback>): Feedback => ({ id: Math.random().toString(36), at: '2026-09-02T20:00:00Z', target: { type: 'recording', id: 'rec_a' }, ...over })
const concert = (over: Partial<Concert>): Concert => ({
  id: 'c1', venue: 'Ateneul Român', date: '2026-10-08', soloists: [], works: [{ workId: 'w_mer', composer: 'Debussy', title: 'La mer' }], source: 'typed', createdAt: '2026-10-08T22:00:00Z', ...over,
})
const base = {
  workId: 'w_mer', recordingIds: ['rec_b'], since: '2026-10-12T08:00:00Z', today: '2026-10-14',
  dateOf: (at: string) => at.slice(0, 10), events: [] as ListeningEvent[], feedback: [] as Feedback[], concerts: [] as Concert[],
}

describe('your earlier hearing', () => {
  it('is nothing the first time a work is met', () => {
    expect(earlierHearing(base)).toBeUndefined()
  })

  it('names the latest hearing before this programme, and what was said of it', () => {
    const got = earlierHearing({
      ...base,
      events: [ev({ at: '2026-08-01T19:00:00Z' }), ev({ at: '2026-09-02T19:00:00Z' }), ev({ kind: 'partial', at: '2026-09-20T19:00:00Z' })],
      feedback: [fb({ reaction: 'liked' }), fb({ at: '2026-09-03T08:00:00Z', target: { type: 'work', id: 'w_mer' }, note: 'The last panel is a storm.' })],
    })
    expect(got).toEqual({ kind: 'recording', on: '2026-09-02', recordingId: 'rec_a', sameRecording: false, said: { note: 'The last panel is a storm.' } })
  })

  it('leaves out a hearing since this programme was made: that one is this programme’s own', () => {
    expect(earlierHearing({ ...base, events: [ev({ at: '2026-10-13T19:00:00Z', recordingId: 'rec_b' })] })).toBeUndefined()
    // …and what was said since then, about this hearing, isn't the earlier one's.
    const got = earlierHearing({ ...base, events: [ev({})], feedback: [fb({ at: '2026-10-13T08:00:00Z', note: 'today' }), fb({ reaction: 'too-difficult' })] })
    expect(got?.said).toEqual({ reaction: 'too-difficult' })
  })

  it('reads a Spotify play at the time it was played, and knows when it was the same recording', () => {
    const got = earlierHearing({ ...base, events: [ev({ source: 'spotify-recent', at: '2026-10-13T10:00:00Z', playedAt: '2026-09-30T18:00:00Z', playedUntil: '2026-09-30T18:40:00Z', recordingId: 'rec_b' })] })
    expect(got).toMatchObject({ kind: 'recording', on: '2026-09-30', sameRecording: true })
  })

  it('remembers the hall: a concert on or before today, later than the last recording heard', () => {
    const got = earlierHearing({ ...base, events: [ev({})], concerts: [concert({ note: 'The brass shook the dome.' }), concert({ id: 'c2', date: '2026-11-02' })] })
    expect(got).toMatchObject({ kind: 'concert', on: '2026-10-08', said: { note: 'The brass shook the dome.' } })
    // A recording heard after the concert is the latest.
    const later = earlierHearing({ ...base, events: [ev({ at: '2026-10-10T19:00:00Z' })], concerts: [concert({})] })
    expect(later?.kind).toBe('recording')
    // Another work's concert says nothing here.
    expect(earlierHearing({ ...base, concerts: [concert({ works: [{ workId: 'w_other', composer: 'Ravel', title: 'Boléro' }] })] })).toBeUndefined()
  })

  it('takes a concert’s note from its feedback when the concert has none of its own', () => {
    const got = earlierHearing({ ...base, concerts: [concert({})], feedback: [fb({ target: { type: 'concert', id: 'c1' }, note: 'Too loud in the hall.' })] })
    expect(got?.said).toEqual({ note: 'Too loud in the hall.' })
  })

  it('says a date as a person would, and keeps a note to one line', () => {
    expect(onDay('2026-10-03', '2026-10-14')).toBe('3 October')
    expect(onDay('2025-12-20', '2026-10-14')).toBe('20 December 2025')
    expect(shortNote('short')).toBe('short')
    const long = 'word '.repeat(60)
    expect(shortNote(long).length).toBeLessThanOrEqual(141)
    expect(shortNote(long).endsWith('word…')).toBe(true)
  })

  it('counts a hearing in another programme made since this one, with what was said there', () => {
    const got = earlierHearing({
      ...base, programmeId: 'prog_b',
      events: [ev({ at: '2026-10-13T19:00:00Z', programmeId: 'prog_a' }), ev({ at: '2026-10-13T21:00:00Z', programmeId: 'prog_b', recordingId: 'rec_b' })],
      feedback: [fb({ at: '2026-10-13T19:30:00Z', programmeId: 'prog_a', note: 'Slower than I knew it.' })],
    })
    expect(got).toMatchObject({ kind: 'recording', on: '2026-10-13', recordingId: 'rec_a', said: { note: 'Slower than I knew it.' } })
  })
})
