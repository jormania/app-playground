import { describe, expect, it } from 'vitest'
import type { JudgeSummary, NoteResult } from './judge'
import type { Hand, SongNote } from './song'
import { summaryForHand } from './together'
import { buildReport } from './feedback'
import { DEFAULT_SETTINGS } from './settings'

const result = (id: number, hand: Hand, pitch: number, outcome: NoteResult['outcome'] = 'hit'): NoteResult => ({ note: { id, hand, pitch, startMs: id * 500, durationMs: 400, bar: 0 } as SongNote, outcome })

describe('summaryForHand', () => {
  const s: JudgeSummary = {
    results: [result(0, 'right', 67), result(1, 'left', 48), result(2, 'right', 69, 'missed'), result(3, 'left', 43)],
    wrong: [
      { pitch: 70, atMs: 100, bar: 0 },
      { pitch: 40, atMs: 900, bar: 1 },
    ],
    total: 4,
    done: true,
    mode: 'running',
  }

  it('gives each player their own notes and their own wrong keys', () => {
    const right = summaryForHand(s, 'right')
    const left = summaryForHand(s, 'left')
    expect(right.results.map((r) => r.note.id)).toEqual([0, 2])
    expect(right.wrong.map((w) => w.pitch)).toEqual([70])
    expect(right.total).toBe(2)
    expect(left.results.map((r) => r.note.id)).toEqual([1, 3])
    expect(left.wrong.map((w) => w.pitch)).toEqual([40])
  })

  it('is scored as a song of its own', () => {
    expect(buildReport(summaryForHand(s, 'right'), DEFAULT_SETTINGS).stars).toBe(1)
    expect(buildReport(summaryForHand(s, 'left'), DEFAULT_SETTINGS).stars).toBe(3)
  })
})
