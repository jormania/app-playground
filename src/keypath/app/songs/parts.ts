import { notesFor, type JudgeSummary, type Practice, type Song } from '../../engine'
import { K, type KeyValueStore } from '../store'

// Learning a song in parts (KEYPATH_TUTOR.md §10, "Learning curve", slice 2):
// phrase 1, then phrase 2, then the two together, and so on to the whole
// song. The parts are played in "Wait for it", so the notes come before the
// clock. Free of React, like the engine; the progress is kept per player.

/** Songs that don't say where their phrases start are cut every this many bars. */
export const BARS_PER_PHRASE = 4

export type PartKind = 'phrase' | 'join' | 'whole'

export interface PartStep {
  /** 'p2' for phrase 2, '1-3' for phrases 1 to 3 together, 'whole'. */
  id: string
  kind: PartKind
  /** Bars [from, to), 0-based. */
  from: number
  to: number
  /** Phrase numbers from 1: the phrase itself, or where a join starts and ends. */
  first: number
  last: number
}

export const barCount = (song: Song) => (song.notes.length ? Math.max(...song.notes.map((n) => n.bar)) + 1 : 0)

/** Where each phrase starts: the song's own marks, or every four bars (a last scrap of one bar joins the phrase before). */
export function phraseStarts(song: Song): number[] {
  const bars = barCount(song)
  if (song.phrases?.length) return song.phrases.filter((b) => b < bars)
  const starts: number[] = []
  for (let b = 0; b < bars; b += BARS_PER_PHRASE) starts.push(b)
  if (starts.length > 1 && bars - starts[starts.length - 1] < 2) starts.pop()
  return starts
}

/** Bars [from, to) of the song on their own, moved to start at 0 (ids and fingers kept); null if there are no notes there. */
export function rangeSong(song: Song, from: number, to: number, id = `${song.id}#${from + 1}-${to}`): Song | null {
  const inRange = song.notes.filter((n) => n.bar >= from && n.bar < to)
  if (inRange.length === 0) return null
  const start = Math.min(...inRange.map((n) => n.startMs))
  const notes = inRange.map((n) => ({ ...n, startMs: n.startMs - start }))
  return { ...song, id, notes, durationMs: Math.max(...notes.map((n) => n.startMs + n.durationMs)) }
}

/** What a stretch of the song sounds like for these hands: the same shape twice is the same phrase. */
function shape(song: Song, practice: Practice, from: number, to: number): string {
  const part = rangeSong(song, from, to)
  if (!part) return ''
  return notesFor(part, practice)
    // To the nearest 20 ms: the same rhythm lands a millisecond apart where beats don't divide evenly.
    .map((n) => `${n.hand[0]}${n.pitch}@${Math.round(n.startMs / 20)}`)
    .join(' ')
}

/**
 * The way through a song in parts: each new phrase alone, and after each one
 * from the second on, everything from the start up to it; then the whole
 * song. A phrase that repeats an earlier one (Twinkle's last line is its
 * first) isn't learnt twice. Empty for a song too short to split.
 */
export function partSteps(song: Song, practice: Practice): PartStep[] {
  const starts = phraseStarts(song)
  if (starts.length < 2) return []
  const bars = barCount(song)
  const seen = new Set<string>()
  const steps: PartStep[] = []
  let learnt = 0
  starts.forEach((from, i) => {
    const to = starts[i + 1] ?? bars
    const n = i + 1
    const sig = shape(song, practice, from, to)
    if (!sig || seen.has(sig)) return
    seen.add(sig)
    steps.push({ id: `p${n}`, kind: 'phrase', from, to, first: n, last: n })
    learnt++
    if (learnt >= 2 && to < bars) steps.push({ id: `1-${n}`, kind: 'join', from: 0, to, first: 1, last: n })
  })
  if (steps.length === 0) return []
  steps.push({ id: 'whole', kind: 'whole', from: 0, to: bars, first: 1, last: starts.length })
  return steps
}

/** Wrong keys (and missed notes) a part can take and still count as learnt: two, or one in ten for a long one. */
export const partAllowance = (total: number) => Math.max(2, Math.floor(total / 10))

export function partPassed(s: JudgeSummary): boolean {
  const missed = s.results.filter((r) => r.outcome === 'missed').length
  return s.done && s.wrong.length + missed <= partAllowance(s.total)
}

/** The first step not learnt yet, or the whole song once they all are. */
export function nextStep(steps: readonly PartStep[], learnt: ReadonlySet<string>): PartStep | null {
  return steps.find((s) => !learnt.has(s.id)) ?? steps[steps.length - 1] ?? null
}

/** Which parts each player has learnt, song by song and by hands (right, left, both are learnt separately). */
export class PartsRepo {
  constructor(private readonly store: KeyValueStore) {}

  private key = (songId: string, practice: Practice) => `${songId}|${practice}`

  async get(profileId: string, songId: string, practice: Practice): Promise<Set<string>> {
    const all = (await this.store.get<Record<string, string[]>>(K.parts(profileId))) ?? {}
    return new Set(all[this.key(songId, practice)] ?? [])
  }

  async pass(profileId: string, songId: string, practice: Practice, stepId: string): Promise<Set<string>> {
    const all = (await this.store.get<Record<string, string[]>>(K.parts(profileId))) ?? {}
    const k = this.key(songId, practice)
    const learnt = new Set(all[k] ?? [])
    learnt.add(stepId)
    await this.store.set(K.parts(profileId), { ...all, [k]: [...learnt] })
    return learnt
  }

  /** Every song this player is learning in parts, with what's learnt: for Today's pick. */
  async all(profileId: string): Promise<Record<string, string[]>> {
    return (await this.store.get<Record<string, string[]>>(K.parts(profileId))) ?? {}
  }
}
