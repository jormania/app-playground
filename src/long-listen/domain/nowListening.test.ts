import { describe, expect, it } from 'vitest'
import { LEFT_FOR_MS, leftPartWay, listenTargetFor } from './nowListening'
import type { Comparison, Programme, ProgrammeItem, Recording } from './types'

const item = (id: string, recordingId: string, work: string) => ({ id, workId: `w-${id}`, recordingId, proposed: { composer: 'Béla Bartók', work, soloists: [] }, why: '', whyThisRecording: '', listenFor: [] }) as unknown as ProgrammeItem
const programme = (id: string, weekKey: string, createdAt: string, items: ProgrammeItem[]) =>
  ({ id, weekKey, createdAt, title: id, sections: [{ id: 's', role: 'start', heading: 'H', items }], comparisonIds: [] }) as unknown as Programme
const rec = (id: string, trackIds?: string[]) => ({ id, workId: 'w', soloistIds: [], character: [], verification: trackIds ? 'verified' : 'not-found', ...(trackIds ? { spotify: { trackIds, trackUris: [], albumId: 'a' } } : {}) }) as unknown as Recording

describe('the work a Spotify track belongs to (the masthead’s listen along, 23 October 2026)', () => {
  const recordings = [rec('r-shaham', ['t1', 't2', 't3']), rec('r-missing'), rec('r-standin', ['s1', 's2'])]
  const programmes = [
    programme('old', '2026-W40', '2026-10-01', [item('i-old', 'r-shaham', 'Violin Concerto No. 2')]),
    programme('now', '2026-W43', '2026-10-19', [item('i-now', 'r-shaham', 'Violin Concerto No. 2'), item('i-miss', 'r-missing', 'Cello Concerto')]),
  ]
  const comparisons = [{ id: 'cmp:now:i-miss', standIn: true, perspectives: [{ recordingId: 'r-missing' }, { recordingId: 'r-standin' }] }] as unknown as Comparison[]
  const input = { recordings, programmes, comparisons }

  it('finds the work by any of its movements, this week’s programme first', () => {
    expect(listenTargetFor(['t2'], input, '2026-W43')).toMatchObject({ programmeId: 'now', itemId: 'i-now', work: 'Violin Concerto No. 2', trackIds: ['t1', 't2', 't3'] })
  })
  it('finds the work a stand-in played for', () => {
    expect(listenTargetFor(['s1'], input, '2026-W43')).toMatchObject({ programmeId: 'now', itemId: 'i-miss', trackIds: ['s1', 's2'] })
  })
  it('reads a relinked track by the id that was asked for', () => {
    expect(listenTargetFor(['relinked', 't3'], input, '2026-W43')).toMatchObject({ itemId: 'i-now' })
  })
  it('leads nowhere for music no programme holds', () => {
    expect(listenTargetFor(['elsewhere'], input, '2026-W43')).toBeNull()
    expect(listenTargetFor([undefined], input, '2026-W43')).toBeNull()
  })
})

describe('the work left part-way most recently (23 October 2026)', () => {
  const recordings = [rec('r-gub', ['g1', 'g2']), rec('r-bartok', ['b1']), rec('r-missing'), rec('r-standin', ['s1'])]
  const programmes = [programme('now', '2026-W43', '2026-10-19', [item('i-gub', 'r-gub', 'Offertorium'), item('i-bartok', 'r-bartok', 'Violin Concerto No. 2'), item('i-miss', 'r-missing', 'Cello Concerto')])]
  const comparisons = [{ id: 'cmp:now:i-miss', standIn: true, perspectives: [{ recordingId: 'r-missing' }, { recordingId: 'r-standin' }] }] as unknown as Comparison[]
  const input = { recordings, programmes, comparisons }
  const NOW = 10 * LEFT_FOR_MS

  it('however it was played: the latest place kept leads there', () => {
    const places: Record<string, number> = { g1: NOW - 60_000, b1: NOW - 3_600_000 }
    expect(leftPartWay(input, (ids) => (places[ids[0]] ? { at: places[ids[0]] } : null), NOW)).toMatchObject({ itemId: 'i-gub', work: 'Offertorium' })
  })
  it('a stand-in left part-way leads to the work it stood in for', () => {
    expect(leftPartWay(input, (ids) => (ids[0] === 's1' ? { at: NOW } : null), NOW)).toMatchObject({ itemId: 'i-miss' })
  })
  it('nothing left within the last eighteen hours: nothing', () => {
    expect(leftPartWay(input, () => ({ at: NOW - LEFT_FOR_MS - 1 }), NOW)).toBeNull()
    expect(leftPartWay(input, () => null, NOW)).toBeNull()
  })
})
