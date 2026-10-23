import { describe, it, expect } from 'vitest'
import { catalogueNotInTitle, filingLetter, libraryEntries, performerEntries, viewLibrary, type LibraryInput } from './library'
import { searchLibrary } from './librarySearch'
import { composerEntry } from './composerGroups'
import type { Comparison, Concert, Feedback, ListeningEvent, Programme, ProgrammeItem, ProposedRecording, Recording, WeekRecord, Work } from './types'

const proposed = (composer: string, work: string, more: Partial<ProposedRecording> = {}): ProposedRecording => ({ composer, work, soloists: [], ...more })
const item = (id: string, workId: string, recordingId: string, p: ProposedRecording) => ({ id, workId, recordingId, proposed: p, why: '', whyThisRecording: '', listenFor: [] }) as ProgrammeItem
const programme = (id: string, createdAt: string, items: ProgrammeItem[], more: Partial<Programme> = {}) =>
  ({ id, title: `Programme ${id}`, createdAt, sections: [{ id: 's', role: 'start', heading: 'H', items }], comparisonIds: [], ...more }) as unknown as Programme
const work = (id: string, title: string, more: Partial<Work> = {}): Work => ({ id, composerId: 'c', title, ...more })
const rec = (id: string, workId: string, more: Partial<Recording> = {}): Recording => ({ id, workId, soloistIds: [], character: [], verification: 'verified', ...more })
const comparison = (id: string, workId: string, createdAt: string, perspectives: [string, ProposedRecording][], more: Partial<Comparison> = {}): Comparison =>
  ({ id, workId, framing: '', whyBoth: '', origin: 'on-request', createdAt, perspectives: perspectives.map(([recordingId, p]) => ({ recordingId, proposed: p, character: '' })), ...more })
const event = (recordingId: string, kind: ListeningEvent['kind'], at = '2026-10-10T10:00:00Z') => ({ id: `e-${recordingId}-${kind}`, at, kind, recordingId, workId: '', source: 'manual' }) as ListeningEvent
const feedback = (targetId: string, type: Feedback['target']['type'], more: Partial<Feedback> = {}) => ({ id: `f-${targetId}-${more.note ?? more.reaction}`, at: '2026-10-10T11:00:00Z', target: { type, id: targetId }, ...more }) as Feedback

const boulez = proposed('Claude Debussy', 'La mer', { conductor: 'Pierre Boulez', orchestra: 'Cleveland Orchestra' })
const rattle = proposed('Claude Debussy', 'La mer', { conductor: 'Simon Rattle', orchestra: 'Berliner Philharmoniker' })
const karajan = proposed('Claude Debussy', 'La mer', { conductor: 'Herbert von Karajan', orchestra: 'Berliner Philharmoniker' })

function input(more: Partial<LibraryInput>): LibraryInput {
  return { works: [], recordings: [], programmes: [], comparisons: [], events: [], feedback: [], concerts: [], weeks: [], explorations: [], ...more }
}
const opts = { hideSkipped: false, today: '2026-10-15' }
const rowsOf = (entries: ReturnType<typeof libraryEntries>, workId = 'w-mer') => entries.flatMap((e) => e.works).find((w) => w.work.id === workId)?.recordings ?? []

describe('libraryEntries — a stand-in is its item', () => {
  const base = () => input({
    works: [work('w-mer', 'La mer')],
    recordings: [rec('r-boulez', 'w-mer', { verification: 'not-found' }), rec('r-rattle', 'w-mer')],
    programmes: [programme('p1', '2026-10-05', [item('i1', 'w-mer', 'r-boulez', boulez)])],
    comparisons: [comparison('cmp:p1:i1', 'w-mer', '2026-10-06', [['r-boulez', boulez], ['r-rattle', rattle]], { standIn: true })],
  })

  it('shows the curator’s row alone while nothing of the stand-in has been played', () => {
    const rows = rowsOf(libraryEntries(base(), opts))
    expect(rows.map((r) => r.recordingId)).toEqual(['r-boulez'])
    expect(rows[0].note).toBeUndefined()
  })

  it('carries the programme item it was met as, the way back into its listening view (batch one, 23 October 2026)', () => {
    const rows = rowsOf(libraryEntries({ ...base(), comparisons: [comparison('cmp:p1:i1', 'w-mer', '2026-10-06', [['r-boulez', boulez], ['r-karajan', karajan]])] }, opts))
    expect(rows.find((r) => r.recordingId === 'r-boulez')).toMatchObject({ programmeId: 'p1', itemId: 'i1' })
    // Another perspective has no listening view of its own: no item to lead to.
    expect(rows.find((r) => r.recordingId === 'r-karajan')?.itemId).toBeUndefined()
  })

  it('shows one row — the recording that played — with the curator’s choice as a note, and reads both as one', () => {
    const rows = rowsOf(libraryEntries({ ...base(), events: [event('r-rattle', 'heard')], feedback: [feedback('r-rattle', 'recording', { reaction: 'loved' })] }, opts))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ recordingId: 'r-rattle', state: 'heard', note: 'on Spotify instead of Pierre Boulez’s recording', programmeId: 'p1', said: { reaction: 'loved' } })
    expect(rows[0].proposed.conductor).toBe('Simon Rattle')
    expect(rows[0].ids).toEqual(['r-boulez', 'r-rattle'])
  })

  it('hides the item skipped through either recording', () => {
    const entries = libraryEntries({ ...base(), events: [event('r-rattle', 'skipped')] }, { ...opts, hideSkipped: true })
    expect(entries).toEqual([])
  })
})

describe('libraryEntries — what was said', () => {
  it('reads the work’s own word with the curator’s recording, once, and every note', () => {
    const entries = libraryEntries(input({
      works: [work('w-mer', 'La mer')],
      recordings: [rec('r-boulez', 'w-mer'), rec('r-karajan', 'w-mer')],
      programmes: [programme('p1', '2026-10-05', [item('i1', 'w-mer', 'r-boulez', boulez)])],
      comparisons: [comparison('cmp:p1:i1', 'w-mer', '2026-10-06', [['r-boulez', boulez], ['r-karajan', karajan]])],
      feedback: [feedback('w-mer', 'work', { reaction: 'loved', note: 'The sea at noon.' }), feedback('r-boulez', 'recording', { note: 'Clear as glass.' })],
    }), opts)
    const [first, second] = rowsOf(entries)
    expect(first.said).toEqual({ reaction: 'loved', notes: ['Clear as glass.', 'The sea at noon.'] })
    expect(second.said).toEqual({ reaction: undefined, notes: [] })
  })
})

describe('libraryEntries — order and provenance', () => {
  it('puts the curator’s recording first, then the others as they were met, each credited to its own programme', () => {
    const entries = libraryEntries(input({
      works: [work('w-mer', 'La mer')],
      // Key order deliberately the reverse of when each was met.
      recordings: [rec('r-rattle', 'w-mer'), rec('r-karajan', 'w-mer'), rec('r-boulez', 'w-mer')],
      programmes: [
        programme('p1', '2026-10-01', [item('i1', 'w-mer', 'r-boulez', boulez)]),
        programme('p2', '2026-10-08', [item('i2', 'w-mer', 'r-boulez', boulez)]),
      ],
      comparisons: [
        // Asked from the second programme, not the first one the work was in.
        comparison('cmp:p2:i2', 'w-mer', '2026-10-09', [['r-boulez', boulez], ['r-karajan', karajan]]),
        comparison('cmp_pair', 'w-mer', '2026-10-01', [['r-boulez', boulez], ['r-rattle', rattle]], { origin: 'programme' }),
      ],
    }), opts)
    const rows = rowsOf(entries)
    expect(rows.map((r) => [r.recordingId, r.programmeId, r.note])).toEqual([
      ['r-boulez', 'p1', undefined],
      ['r-rattle', undefined, 'another perspective'],
      ['r-karajan', 'p2', 'another perspective'],
    ])
  })

  it('credits a programme’s own pair to the programme that lists it', () => {
    const entries = libraryEntries(input({
      works: [work('w-mer', 'La mer')],
      recordings: [rec('r-boulez', 'w-mer'), rec('r-rattle', 'w-mer')],
      programmes: [programme('p1', '2026-10-01', [item('i1', 'w-mer', 'r-boulez', boulez)], { comparisonIds: ['cmp_pair'] })],
      comparisons: [comparison('cmp_pair', 'w-mer', '2026-10-01', [['r-boulez', boulez], ['r-rattle', rattle]], { origin: 'programme' })],
    }), opts)
    expect(rowsOf(entries).map((r) => [r.recordingId, r.programmeId])).toEqual([['r-boulez', 'p1'], ['r-rattle', 'p1']])
  })
})

describe('libraryEntries — what counts', () => {
  const concert = (id: string, date: string, workId: string, composer: string, title: string): Concert =>
    ({ id, venue: 'Ateneul Român', date, soloists: [], works: [{ workId, composer, title }], source: 'typed', createdAt: '2026-10-01' })

  it('never files a concert still to come as heard live', () => {
    const entries = libraryEntries(input({
      works: [work('w-sch', 'Scheherazade, Op. 35', { catalogue: 'Op. 35' }), work('w-faune', 'Prélude à l’après-midi d’un faune')],
      concerts: [concert('c-future', '2026-11-20', 'w-sch', 'Nikolai Rimsky-Korsakov', 'Scheherazade'), concert('c-past', '2026-10-15', 'w-faune', 'Debussy', 'Faune')],
    }), opts)
    expect(entries.map((e) => e.composer)).toEqual(['Debussy'])
    expect(entries[0].works[0].live.map((c) => c.id)).toEqual(['c-past'])
  })

  it('leaves out what was never begun of a programme set aside by a change of direction', () => {
    const daphnis = proposed('Maurice Ravel', 'Daphnis et Chloé', { conductor: 'Pierre Monteux' })
    const bolero = proposed('Maurice Ravel', 'Boléro', { conductor: 'Pierre Boulez' })
    const base = input({
      works: [work('w-daph', 'Daphnis et Chloé'), work('w-bol', 'Boléro'), work('w-mer', 'La mer')],
      programmes: [
        programme('p-aside', '2026-10-01', [item('i1', 'w-daph', 'r-daph', daphnis), item('i2', 'w-bol', 'r-bol', bolero)]),
        programme('p-more', '2026-10-02', [item('i3', 'w-mer', 'r-boulez', boulez)], { extends: 'p-aside' }),
      ],
      weeks: [{ setAsideProgrammeIds: ['p-aside'] } as unknown as WeekRecord],
      events: [event('r-daph', 'listening')],
    })
    expect(libraryEntries(base, opts).flatMap((e) => e.works.map((w) => w.work.id))).toEqual(['w-daph'])
    // A word on the work, given from that programme, counts as much as a hearing.
    const said = libraryEntries({ ...base, feedback: [feedback('w-bol', 'work', { note: 'Hypnotic.', programmeId: 'p-aside' })] }, opts)
    expect(said.flatMap((e) => e.works.map((w) => w.work.id)).sort()).toEqual(['w-bol', 'w-daph'])
  })
})

describe('filing', () => {
  it('files a composer by the surname as written: Rimsky-Korsakov under R, Dvořák under D', () => {
    expect(filingLetter('Nikolai Rimsky-Korsakov')).toBe('R')
    expect(filingLetter('Antonín Dvořák')).toBe('D')
    expect(filingLetter('Johann Strauss II')).toBe('S')
    const p = (id: string, composer: string, at: string) => programme(id, at, [item(`i-${id}`, `w-${id}`, `r-${id}`, proposed(composer, id))])
    const entries = libraryEntries(input({
      works: ['a', 'b', 'c'].map((id) => work(`w-${id}`, id)),
      programmes: [p('a', 'Nikolai Rimsky-Korsakov', '1'), p('b', 'Sergei Prokofiev', '2'), p('c', 'Maurice Ravel', '3')],
    }), opts)
    expect(entries.map((e) => e.composer)).toEqual(['Sergei Prokofiev', 'Maurice Ravel', 'Nikolai Rimsky-Korsakov'])
  })

  it('doesn’t repeat a catalogue number the title already carries', () => {
    expect(catalogueNotInTitle('Scheherazade, Op. 35', 'Op. 35')).toBeUndefined()
    expect(catalogueNotInTitle('Scheherazade', 'Op. 35')).toBe('Op. 35')
    expect(catalogueNotInTitle('Symphony No. 3, Op. 35', 'Op. 3')).toBe('Op. 3')
  })
})

describe('composerEntry', () => {
  const entries = [
    { composer: 'Claude Debussy', spellings: ['Claude Debussy', 'Debussy'] },
    { composer: 'Johann Strauss II', spellings: ['Johann Strauss II'] },
    { composer: 'Richard Strauss', spellings: ['Richard Strauss'] },
  ]
  it('finds a composer under any spelling, or a bare surname only when it can mean one', () => {
    expect(composerEntry(entries, 'Débussy')?.composer).toBe('Claude Debussy')
    expect(composerEntry([{ composer: 'Claude Debussy', spellings: ['Claude Debussy'] }], 'Debussy')?.composer).toBe('Claude Debussy')
    expect(composerEntry(entries, 'Strauss')).toBeUndefined()
    expect(composerEntry(entries, 'Lili Boulanger')).toBeUndefined()
  })
})

describe('the Library seen three ways, and a performer’s part of it (batch three, 23 October 2026)', () => {
  const base = input({
    works: [work('w-mer', 'La mer'), work('w-jeux', 'Jeux'), work('w-faune', 'Prélude à l’après-midi d’un faune')],
    recordings: [rec('r-boulez', 'w-mer'), rec('r-rattle', 'w-jeux'), rec('r-karajan', 'w-faune')],
    programmes: [
      programme('p1', '2026-10-05', [item('i1', 'w-mer', 'r-boulez', boulez)]),
      programme('p2', '2026-10-12', [item('i2', 'w-jeux', 'r-rattle', proposed('Claude Debussy', 'Jeux', { conductor: 'Simon Rattle', orchestra: 'Berliner Philharmoniker' }))]),
      programme('p3', '2026-10-19', [item('i3', 'w-faune', 'r-karajan', proposed('Claude Debussy', 'Prélude', { conductor: 'Herbert von Karajan', orchestra: 'Berliner Philharmoniker' }))]),
    ],
    events: [event('r-rattle', 'heard')],
    feedback: [feedback('w-jeux', 'work', { reaction: 'loved', note: 'The tennis ballet that never settles.' })],
  })
  const entries = libraryEntries(base, opts)
  const titles = (es: typeof entries) => es.flatMap((e) => e.works.map((w) => w.work.title))

  it('Everything is as filed; Heard keeps only what was heard; Recent puts the latest met first', () => {
    expect(titles(viewLibrary(entries, 'all'))).toEqual(['Jeux', 'La mer', 'Prélude à l’après-midi d’un faune'])
    expect(titles(viewLibrary(entries, 'heard'))).toEqual(['Jeux'])
    expect(titles(viewLibrary(entries, 'recent'))).toEqual(['Prélude à l’après-midi d’un faune', 'Jeux', 'La mer'])
  })

  it('search finds a work by what was said of it, and by the programme it came from', () => {
    expect(titles(searchLibrary(entries, 'tennis'))).toEqual(['Jeux'])
    expect(titles(searchLibrary(entries, 'loved'))).toEqual(['Jeux'])
    expect(titles(searchLibrary(entries, 'Programme p1'))).toEqual(['La mer'])
  })

  it('a performer’s part: only their recordings, matched whole, with what they were', () => {
    const berlin = performerEntries(entries, 'Berliner Philharmoniker')
    expect(titles(berlin.entries)).toEqual(['Jeux', 'Prélude à l’après-midi d’un faune'])
    expect(berlin.roles).toEqual(['orchestra'])
    const boulezOnly = performerEntries(entries, 'pierre boulez')
    expect(titles(boulezOnly.entries)).toEqual(['La mer'])
    expect(boulezOnly.roles).toEqual(['conductor'])
    expect(performerEntries(entries, 'Boulez').entries).toEqual([])
  })
})
