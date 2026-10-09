import { describe, it, expect, vi } from 'vitest'
import { liveEvents, liveMatches, meet, whatIsOn } from './live'
import type { Programme, ProgrammeItem } from '../domain/types'

const item = (composer: string, work: string, conductor?: string, soloists: string[] = []): ProgrammeItem => ({
  id: work, workId: work, recordingId: `r-${work}`, why: '', whyThisRecording: '', listenFor: [],
  proposed: { composer, work, conductor, soloists: soloists.map((name) => ({ name })) },
})
const programme = (items: ProgrammeItem[]) => ({ id: 'p', sections: [{ id: 's', role: 'start', heading: 'H', items }] }) as unknown as Programme

describe('live in Bucharest', () => {
  it('knows the very work in a Romanian title, a performer, or only the composer', () => {
    const ev = (title: string, description = '') => ({ venue: 'Filarmonica George Enescu', title, date: '2026-11-14', description })
    expect(meet(item('Jean Sibelius', 'Symphony No. 5 in E-flat major'), ev('Concert simfonic: Sibelius – Simfonia nr. 5'))).toBe('work')
    expect(meet(item('Johannes Brahms', 'Double Concerto in A minor, Op. 102'), ev('Concertul în la minor pentru vioară și violoncel, op. 102 de Brahms'))).toBe('work')
    expect(meet(item('Carl Nielsen', 'Symphony No. 4', 'Herbert Blomstedt'), ev('Dirijor: Herbert Blomstedt', 'Beethoven, Simfonia nr. 7'))).toBe('performer')
    expect(meet(item('Jean Sibelius', 'Tapiola'), ev('Sibelius, Concertul pentru vioară'))).toBe('composer')
    expect(meet(item('Jean Sibelius', 'Tapiola'), ev('Mozart, Requiem'))).toBeNull()
  })

  it('keeps one concert per work, from today on, closest matches first', () => {
    const p = programme([item('Jean Sibelius', 'Tapiola'), item('Jean Sibelius', 'Symphony No. 5')])
    const events = [
      { venue: 'Sala Radio', title: 'Sibelius: Simfonia nr. 5', date: '2026-11-20' },
      { venue: 'Filarmonica George Enescu', title: 'Sibelius și Grieg', date: '2026-11-01' },
      { venue: 'Filarmonica George Enescu', title: 'Sibelius: Simfonia nr. 5', date: '2026-10-01' }, // past
    ]
    const m = liveMatches(p, events, '2026-10-10')
    expect(m.map((x) => [x.item.proposed.work, x.how, x.event.date])).toEqual([['Symphony No. 5', 'work', '2026-11-20'], ['Tapiola', 'composer', '2026-11-01']])
    expect(whatIsOn(m[0])).toBe('Sibelius’s Symphony No. 5')
  })

  it('asks Marquee’s endpoint at most once a day', async () => {
    const store = new Map<string, { id: string; at: string; value?: unknown }>()
    const marks = { get: async (id: string) => store.get(id), put: async (m: { id: string; at: string; value?: unknown }) => { store.set(m.id, m) } }
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ events: [{ venue: 'Sala Radio', title: 'T', date: '2026-11-20', key: 'x' }] })))
    const first = await liveEvents(marks, fetchImpl as unknown as typeof fetch, new Date('2026-10-10T10:00:00Z'))
    expect(first).toEqual([{ venue: 'Sala Radio', title: 'T', date: '2026-11-20', time: undefined, hall: undefined, link: undefined, description: undefined }])
    await liveEvents(marks, fetchImpl as unknown as typeof fetch, new Date('2026-10-10T20:00:00Z'))
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    await liveEvents(marks, fetchImpl as unknown as typeof fetch, new Date('2026-10-11T11:00:00Z'))
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})
