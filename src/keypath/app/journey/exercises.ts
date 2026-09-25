import { Judge, notesFor, type Finger, type Hand, type Practice, type Song, type SongNote, type Step } from '../../engine'
import type { StringKey } from '../i18n'

// The Journey's exercises: small judges for one kind of task each, free of
// React so they can be tested on their own. Every pitch they receive is the
// pitch as drawn on screen (any octave shift already applied by the caller).

/** What to say: a string key, and optionally a key to name in her note names. */
export interface Say {
  key: StringKey
  /** Pitches whose names fill {note}, {note2}, {note3} (the caller words them: C, Do, or both). */
  notes?: number[]
  vars?: Record<string, string | number>
}

export interface ExerciseView {
  /** Keys to light up. Empty in a check: finding them is the test. */
  targets: number[]
  say: Say
  done: number
  total: number
  /** The finger asked for, when the task names one (the finger-numbers step). */
  finger?: FingerAsk
}

export interface FingerAsk {
  hand: Hand
  finger: Finger
}

/** 'spread': the right keys, not together enough to be a chord. */
export type Outcome = 'right' | 'wrong' | 'spread' | null

export interface Exercise {
  press(pitch: number, atMs: number): Outcome
  release(pitch: number): void
  view(): ExerciseView
  readonly finished: boolean
  readonly wrong: number
}

const pc = (p: number) => ((p % 12) + 12) % 12

export interface Prompt {
  accept: (pitch: number) => boolean
  /** Keys shown as the answer (a practice); omit for a check. */
  show?: number[]
  say: Say
  finger?: FingerAsk
}

/** One key at a time, each asked for in turn. A wrong key counts; the prompt stays. */
export class Prompts implements Exercise {
  private i = 0
  wrong = 0
  constructor(private readonly prompts: Prompt[]) {}
  get finished() {
    return this.i >= this.prompts.length
  }
  press(pitch: number): Outcome {
    const p = this.prompts[this.i]
    if (!p) return null
    if (p.accept(pitch)) {
      this.i++
      return 'right'
    }
    this.wrong++
    return 'wrong'
  }
  release() {}
  view(): ExerciseView {
    const p = this.prompts[Math.min(this.i, this.prompts.length - 1)]
    return { targets: this.finished ? [] : (p.show ?? []), say: p.say, done: this.i, total: this.prompts.length, finger: p.finger }
  }
}

/** Every key with a given name, anywhere on the keyboard: "press three different Cs". */
export class FindAll implements Exercise {
  private found = new Set<number>()
  wrong = 0
  constructor(
    private readonly pitchClass: number,
    private readonly count: number,
    private readonly say: Say,
  ) {}
  get finished() {
    return this.found.size >= this.count
  }
  press(pitch: number): Outcome {
    if (this.finished) return null
    if (pc(pitch) !== this.pitchClass) {
      this.wrong++
      return 'wrong'
    }
    if (this.found.has(pitch)) return null // the same C again: harmless
    this.found.add(pitch)
    return 'right'
  }
  release() {}
  view(): ExerciseView {
    return { targets: [], say: this.say, done: this.found.size, total: this.count }
  }
}

export interface ChordTask {
  /** The chord's note names, as pitch classes: any octave, any order. */
  pitchClasses: number[]
  show?: number[]
  say: Say
}

/**
 * Chords played together. All the chord's keys must go down within `windowMs`
 * (from her Timing setting); keys spread wider are a near miss, said kindly,
 * not a wrong note. After each attempt every key is lifted before the next.
 */
export class Chords implements Exercise {
  private i = 0
  private down = new Map<number, number>()
  private waitForRelease = false
  wrong = 0
  spread = 0
  constructor(
    private readonly tasks: ChordTask[],
    private readonly windowMs: number,
  ) {}
  get finished() {
    return this.i >= this.tasks.length
  }
  press(pitch: number, atMs: number): Outcome {
    const task = this.tasks[this.i]
    if (!task || this.waitForRelease) return null
    if (!task.pitchClasses.includes(pc(pitch))) {
      this.wrong++
      this.waitForRelease = true
      return 'wrong'
    }
    this.down.set(pitch, atMs)
    const names = new Set([...this.down.keys()].map(pc))
    if (!task.pitchClasses.every((c) => names.has(c))) return null
    const times = [...this.down.values()]
    this.waitForRelease = true
    if (Math.max(...times) - Math.min(...times) <= this.windowMs) {
      this.i++
      return 'right'
    }
    this.spread++
    return 'spread'
  }
  release(pitch: number) {
    this.down.delete(pitch)
    if (this.down.size === 0) this.waitForRelease = false
  }
  view(): ExerciseView {
    const t = this.tasks[Math.min(this.i, this.tasks.length - 1)]
    return { targets: this.finished ? [] : (t.show ?? []), say: t.say, done: this.i, total: this.tasks.length }
  }
}

/**
 * A short tune, in "Wait for it": the engine's judge holds on each note until
 * it's played, so nothing is ever late. In a practice the next keys light up;
 * in a check they don't.
 */
export class Tune implements Exercise {
  readonly notes: SongNote[]
  private readonly judge: Judge
  private hits = 0
  wrong = 0
  constructor(
    song: Song,
    practice: Practice,
    private readonly showKeys: boolean,
    private readonly say: Say,
  ) {
    this.notes = notesFor(song, practice)
    this.judge = new Judge(song, { practice, settings: { onWrong: 'wait', timing: 'relaxed', report: 'off', wrongAffectsStars: false } })
  }
  get finished() {
    return this.judge.currentStep === null
  }
  /** The step being waited on, for the falling notes and the staff's cursor. */
  get step(): Step | null {
    return this.judge.currentStep
  }
  /** Ids of the notes already played. */
  played(): Set<number> {
    return new Set(this.judge.summary().results.map((r) => r.note.id))
  }
  press(pitch: number, atMs: number): Outcome {
    const events = this.judge.press(pitch, atMs)
    if (events.some((e) => e.type === 'wrong')) {
      this.wrong++
      return 'wrong'
    }
    if (events.some((e) => e.type === 'hit')) {
      this.hits++
      return 'right'
    }
    return null
  }
  release() {}
  view(): ExerciseView {
    const step = this.judge.currentStep
    return { targets: this.showKeys && step ? step.notes.map((n) => n.pitch) : [], say: this.say, done: this.hits, total: this.notes.length }
  }
}
