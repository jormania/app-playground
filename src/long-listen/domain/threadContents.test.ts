import { describe, it, expect } from 'vitest'
import { heldBy, threadContents, threadsToShow } from './threadContents'
import type { Feedback, ListeningEvent, Programme, Theme, ThemeExploration, Work } from './types'

const item = (id: string, workId: string, composer: string) => ({ id, workId, recordingId: `r-${id}`, why: '', whyThisRecording: '', listenFor: [], proposed: { composer, work: workId, soloists: [] } })
const programme = (items: ReturnType<typeof item>[], id = 'p') => ({ id, sections: [{ id: 's', role: 'start', heading: 'H', items }] }) as unknown as Programme
const theme = (id: string, updatedAt = '2026-10-01') => ({ id, title: id, updatedAt }) as unknown as Theme
const visit = (id: string, themeId: string, weekKey: string, programmeId: string, more: Partial<ThemeExploration> = {}) =>
  ({ id, themeId, weekKey, programmeId, ...more }) as ThemeExploration

describe('threadContents', () => {
  it('says how many works, by how many composers, from when, and how far in — no length, no counts of visits', () => {
    const p = programme([item('a', 'w1', 'Jean Sibelius'), item('b', 'w2', 'Jean Sibelius'), item('c', 'w3', 'Carl Nielsen')])
    const works = new Map<string, Work>([
      ['w1', { id: 'w1', composedId: '', title: '', composed: '1915–19' } as unknown as Work],
      ['w2', { id: 'w2', title: '', composed: '1926' } as unknown as Work],
      ['w3', { id: 'w3', title: '' } as unknown as Work],
    ])
    const events = [{ recordingId: 'r-a', kind: 'heard', at: 'x' }] as unknown as ListeningEvent[]
    expect(threadContents([{ programme: p }], works, events)).toBe('3 works by 2 composers, written between 1915 and 1926 · 1 heard so far')
  })

  it('counts a work once across visits, and says nothing for an empty thread', () => {
    const p1 = programme([item('a', 'w1', 'A')])
    const p2 = programme([item('b', 'w1', 'A')])
    expect(threadContents([{ programme: p1 }, { programme: p2 }], new Map(), [])).toBe('1 work by 1 composer · none heard yet')
    expect(threadContents([], new Map(), [])).toBe('')
  })

  it('counts a set-aside programme, and its extras, only for what was begun of it (as digestThread does)', () => {
    const kept = programme([item('a', 'w1', 'A')], 'p1')
    const aside = programme([item('b', 'w2', 'B'), item('c', 'w3', 'C')], 'p2')
    const extra = programme([item('d', 'w4', 'D')], 'p3')
    const programmes = new Map([kept, aside, extra].map((p) => [p.id, p]))
    const visits = [visit('v1', 't', '2026-W40', 'p1'), visit('v2', 't', '2026-W41', 'p2', { setAside: true, extraProgrammeIds: ['p3'] })]
    expect(threadContents(heldBy(visits, programmes), new Map(), [])).toBe('1 work by 1 composer · none heard yet')
    const events = [{ recordingId: 'r-b', kind: 'listening', at: 'x' }] as unknown as ListeningEvent[]
    expect(threadContents(heldBy(visits, programmes), new Map(), events)).toBe('2 works by 2 composers · none heard yet')
  })
})

describe('threadsToShow', () => {
  const p1 = programme([item('a', 'w1', 'A')], 'p1')
  const p2 = programme([item('b', 'w2', 'B')], 'p2')
  const programmes = new Map([p1, p2].map((p) => [p.id, p]))

  it('leaves out a direction changed away from before anything of it was heard', () => {
    const visits = [visit('v1', 'gone', '2026-W41', 'p1', { setAside: true }), visit('v2', 'kept', '2026-W41', 'p2')]
    expect(threadsToShow([theme('gone'), theme('kept')], visits, programmes, [], []).map((t) => t.theme.id)).toEqual(['kept'])
  })

  it('keeps it once something of it was heard, or a word said on it', () => {
    const visits = [visit('v1', 'gone', '2026-W41', 'p1', { setAside: true })]
    const played = [{ recordingId: 'r-a', kind: 'play-started', at: 'x' }] as unknown as ListeningEvent[]
    expect(threadsToShow([theme('gone')], visits, programmes, played, [])).toHaveLength(1)
    const loved = [{ target: { type: 'recording', id: 'r-a' }, reaction: 'loved' }] as unknown as Feedback[]
    expect(threadsToShow([theme('gone')], visits, programmes, [], loved)).toHaveLength(1)
    // "I knew this one already" is familiarity, not a hearing.
    const known = [{ target: { type: 'work', id: 'w1' }, programmeId: 'p1', known: true }] as unknown as Feedback[]
    expect(threadsToShow([theme('gone')], visits, programmes, [], known)).toHaveLength(0)
  })

  it('opens the latest visit not set aside, or the last when all were', () => {
    const visits = [visit('v1', 't', '2026-W40', 'p1'), visit('v2', 't', '2026-W41', 'p2', { setAside: true })]
    expect(threadsToShow([theme('t')], visits, programmes, [], [])[0].latest?.id).toBe('v1')
    const aside = visits.map((v) => ({ ...v, setAside: true }))
    const played = [{ recordingId: 'r-a', kind: 'heard', at: 'x' }] as unknown as ListeningEvent[]
    expect(threadsToShow([theme('t')], aside, programmes, played, [])[0].latest?.id).toBe('v2')
  })

  it('orders by the week of the latest visit kept, then by when last written — not by updatedAt alone', () => {
    const visits = [
      visit('v1', 'older', '2026-W39', 'p1'),
      visit('v2', 'newer', '2026-W40', 'p1'),
      visit('v3', 'newer', '2026-W41', 'p2', { setAside: true }),
      visit('v4', 'tied', '2026-W40', 'p2'),
    ]
    // "older" was written last (a curator answering late), but its week is the earliest.
    const themes = [theme('older', '2026-10-09'), theme('newer', '2026-10-02'), theme('tied', '2026-10-05')]
    expect(threadsToShow(themes, visits, programmes, [], []).map((t) => t.theme.id)).toEqual(['tied', 'newer', 'older'])
  })
})
