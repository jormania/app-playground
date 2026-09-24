import { Chords, type ChordTask } from '../journey/exercises'
import { CHORD_WINDOW_MS } from '../journey/steps'
import type { Timing } from '../../engine'

// Chord catch (door C): a chord is named, she plays it — all its keys down
// together, any octave, any order — as many as she can before the clock runs
// out. Judged exactly as the Journey's chord step judges (the same `Chords`
// exercise, one chord at a time), so "together" means the same thing in both.

export type ChordLevel = 1 | 2 | 3

export interface ChordDef {
  id: string
  /** Root pitch class: C = 0. */
  root: number
  minor: boolean
}

const chord = (id: string, root: number, minor = false): ChordDef => ({ id, root, minor })
const MAJOR = [chord('C', 0), chord('F', 5), chord('G', 7)]
const MINOR = [chord('Am', 9, true), chord('Dm', 2, true), chord('Em', 4, true)]
const SHARP = [chord('D', 2), chord('E', 4), chord('A', 9)]

/** C, F and G; then their three minor cousins; then three with a black key in them. */
export const CHORDS: Record<ChordLevel, ChordDef[]> = {
  1: MAJOR,
  2: [...MAJOR, ...MINOR],
  3: [...MAJOR, ...MINOR, ...SHARP],
}

/** Level 3 names the chord and nothing else: working out its keys is the level. */
export const shows = (level: ChordLevel) => level < 3

export const CHORD_MS = 45_000

const pc = (p: number) => ((p % 12) + 12) % 12

export const pitchClassesOf = (c: ChordDef) => [c.root, pc(c.root + (c.minor ? 3 : 4)), pc(c.root + 7)]

/** The on-screen keyboard's range (C3 to C5): every lit chord must fit on it. */
export const SCREEN_KEYS = { low: 48, high: 72 } as const

/**
 * What the screen lights up: root position from middle C, or an octave lower
 * when that would run off the top (G, A), so all three keys are always there.
 */
export const voicingOf = (c: ChordDef) => {
  const root = 60 + c.root + 7 > SCREEN_KEYS.high ? 48 + c.root : 60 + c.root
  return [root, root + (c.minor ? 3 : 4), root + 7]
}

export type ChordOutcome = 'right' | 'wrong' | 'spread' | null

export class ChordCatch {
  private startedAt: number | null = null
  private current: ChordDef
  private judge: Chords
  private held = new Set<number>()
  score = 0
  wrong = 0
  /** The right keys, not together enough to count. */
  spread = 0

  constructor(
    readonly level: ChordLevel,
    readonly timing: Timing = 'relaxed',
    private readonly random: () => number = Math.random,
    readonly durationMs = CHORD_MS,
  ) {
    this.current = this.pick(null)
    this.judge = this.judgeFor(this.current)
  }

  get prompt(): ChordDef {
    return this.current
  }

  start(at: number) {
    this.startedAt = at
  }

  remaining(now: number): number {
    if (this.startedAt === null) return this.durationMs
    return Math.max(0, this.durationMs - (now - this.startedAt))
  }

  finished(now: number): boolean {
    return this.startedAt !== null && this.remaining(now) === 0
  }

  press(pitch: number, at: number): ChordOutcome {
    if (this.startedAt === null || this.finished(at)) return null
    this.held.add(pitch)
    const outcome = this.judge.press(pitch, at)
    if (outcome === 'wrong') this.wrong++
    if (outcome === 'spread') this.spread++
    if (outcome === 'right') this.score++
    return outcome
  }

  /**
   * Keys coming up. After a catch the next chord waits until every key is up,
   * so the hand that just played C isn't read as the start of F.
   */
  release(pitch: number) {
    this.held.delete(pitch)
    this.judge.release(pitch)
    if (this.judge.finished && this.held.size === 0) {
      this.current = this.pick(this.current)
      this.judge = this.judgeFor(this.current)
    }
  }

  /** True while the caught chord is still held down: the next one hasn't been asked yet. */
  get caught(): boolean {
    return this.judge.finished
  }

  private judgeFor(c: ChordDef) {
    const task: ChordTask = { pitchClasses: pitchClassesOf(c), say: { key: 'jChord' } }
    return new Chords([task], CHORD_WINDOW_MS[this.timing])
  }

  /** Never the same chord twice in a row. */
  private pick(previous: ChordDef | null): ChordDef {
    const pool = CHORDS[this.level].filter((c) => c.id !== previous?.id)
    return pool[Math.min(pool.length - 1, Math.floor(this.random() * pool.length))]
  }
}
