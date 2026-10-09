import { describe, it, expect } from 'vitest'
import { threadContents } from './threadContents'
import type { ListeningEvent, Programme, Recording, Work } from './types'

const item = (id: string, workId: string, composer: string) => ({ id, workId, recordingId: `r-${id}`, why: '', whyThisRecording: '', listenFor: [], proposed: { composer, work: workId, soloists: [] } })
const programme = (items: ReturnType<typeof item>[]) => ({ id: 'p', sections: [{ id: 's', role: 'start', heading: 'H', items }] }) as unknown as Programme

describe('threadContents', () => {
  it('says how many works, by how many composers, from when, how long, and how far in', () => {
    const p = programme([item('a', 'w1', 'Jean Sibelius'), item('b', 'w2', 'Jean Sibelius'), item('c', 'w3', 'Carl Nielsen')])
    const works = new Map<string, Work>([
      ['w1', { id: 'w1', composedId: '', title: '', composed: '1915–19' } as unknown as Work],
      ['w2', { id: 'w2', title: '', composed: '1926' } as unknown as Work],
      ['w3', { id: 'w3', title: '' } as unknown as Work],
    ])
    const recordings = new Map<string, Recording>([
      ['r-a', { spotify: { durationMs: 32 * 60_000 } } as unknown as Recording],
      ['r-b', { spotify: { durationMs: 20 * 60_000 } } as unknown as Recording],
    ])
    const events = [{ recordingId: 'r-a', kind: 'heard', at: 'x' }] as unknown as ListeningEvent[]
    expect(threadContents([p], works, recordings, events)).toBe('3 works by 2 composers, written between 1915 and 1926 · about 52 minutes of music · 1 heard so far')
  })

  it('counts a work once across visits, and says nothing for an empty thread', () => {
    const p1 = programme([item('a', 'w1', 'A')])
    const p2 = programme([item('b', 'w1', 'A')])
    expect(threadContents([p1, p2], new Map(), new Map(), [])).toBe('1 work by 1 composer · none heard yet')
    expect(threadContents([], new Map(), new Map(), [])).toBe('')
  })
})
