import { describe, it, expect, vi } from 'vitest'
import { liveEvents, liveMatches, meet, sameEvening, whatIsOn, whatIsOnAt } from './live'
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

  it('keeps each work’s closest concert, from today on, closest matches first', () => {
    const p = programme([item('Jean Sibelius', 'Tapiola'), item('Jean Sibelius', 'Symphony No. 5')])
    const events = [
      { venue: 'Sala Radio', title: 'Sibelius: Simfonia nr. 5', date: '2026-11-20' },
      { venue: 'Filarmonica George Enescu', title: 'Sibelius și Grieg', date: '2026-11-01' },
      { venue: 'Filarmonica George Enescu', title: 'Sibelius: Simfonia nr. 5', date: '2026-10-01' }, // past
    ]
    const m = liveMatches(p, events, '2026-10-10')
    // Sala Radio's Fifth also has Sibelius for Tapiola, but the Fifth names him already.
    expect(m.map((c) => [c.event.date, c.matches.map((x) => [x.item.proposed.work, x.how])])).toEqual([
      ['2026-11-20', [['Symphony No. 5', 'work'], ['Tapiola', 'composer']]],
      ['2026-11-01', [['Tapiola', 'composer'], ['Symphony No. 5', 'composer']]],
    ])
    expect(whatIsOn(m[0].matches[0])).toBe('Sibelius’s Symphony No. 5')
    expect(whatIsOnAt(m[0])).toBe('Sibelius’s Symphony No. 5')
    expect(whatIsOnAt(m[1])).toBe('music by Sibelius')
  })

  it('names one concert once, with every work of the programme it holds', () => {
    const p = programme([item('Claude Debussy', 'La mer'), item('Maurice Ravel', 'Daphnis et Chloé'), item('Maurice Ravel', 'Boléro')])
    const concert = { venue: 'Filarmonica George Enescu', title: 'Debussy – La mer; Ravel – Daphnis et Chloé, suita nr. 2', date: '2026-10-18', time: '19:00', hall: 'Sala Mare' }
    // The same listing read twice (both halls' pages carry it) is still one concert.
    const m = liveMatches(p, [concert, { ...concert }], '2026-10-15')
    expect(m).toHaveLength(1)
    expect(m[0].matches).toHaveLength(3)
    expect(whatIsOnAt(m[0])).toBe('Debussy’s La mer and Ravel’s Daphnis et Chloé')
  })

  it('knows a short title as the very work ("La mer" has no long word to look for)', () => {
    const ev = (title: string) => ({ venue: 'Sala Radio', title, date: '2026-11-14' })
    expect(meet(item('Claude Debussy', 'La mer'), ev('Debussy: La Mer, trei schițe simfonice'))).toBe('work')
    expect(meet(item('Claude Debussy', 'La mer'), ev('Debussy: Nocturnes'))).toBe('composer')
  })

  it('knows one evening however its place was written', () => {
    const at = { venue: 'Filarmonica George Enescu', date: '2026-10-18', hall: 'Sala Mare', time: '19:00' }
    expect(sameEvening(at, { venue: 'The Ateneu', date: '2026-10-18' })).toBe(true)
    expect(sameEvening(at, { venue: 'filarmonica george enescu', date: '2026-10-18', hall: 'sala mare', time: '19:00' })).toBe(true)
    expect(sameEvening(at, { ...at, hall: 'Sala Mică' })).toBe(false)
    expect(sameEvening(at, { ...at, time: '11:00' })).toBe(false)
    expect(sameEvening(at, { ...at, venue: 'Sala Radio' })).toBe(false)
    expect(sameEvening(at, { ...at, date: '2026-10-19' })).toBe(false)
    // As the Philharmonic's feed writes the hall, and as a screenshot or the building's own name has it (a stabilisation finding).
    expect(sameEvening({ ...at, hall: 'Ateneul Român · Sala Mare' }, at)).toBe(true)
    expect(sameEvening({ ...at, hall: 'Ateneul Român · Sala Mare' }, { ...at, venue: 'Ateneul Român' })).toBe(true)
    expect(sameEvening({ ...at, hall: 'Ateneul Român · Sala Mare' }, { ...at, hall: 'Sala Mică' })).toBe(false)
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

  it('offline, keeps the last reading however old, rather than losing the line', async () => {
    const store = new Map<string, { id: string; at: string; value?: unknown }>([['live:scan', { id: 'live:scan', at: '2026-10-01T10:00:00Z', value: [{ venue: 'Sala Radio', title: 'T', date: '2026-11-20' }] }]])
    const marks = { get: async (id: string) => store.get(id), put: async (m: { id: string; at: string; value?: unknown }) => { store.set(m.id, m) } }
    const offline = vi.fn(async () => { throw new TypeError('Failed to fetch') })
    expect(await liveEvents(marks, offline as unknown as typeof fetch, new Date('2026-10-10T10:00:00Z'))).toEqual([{ venue: 'Sala Radio', title: 'T', date: '2026-11-20' }])
    store.clear()
    await expect(liveEvents(marks, offline as unknown as typeof fetch, new Date('2026-10-10T10:00:00Z'))).rejects.toThrow()
  })
})
