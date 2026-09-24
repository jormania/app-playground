import { isPlayerChannel } from '../midi/channels'
import type { MidiEvent } from '../midi/types'
import { MIN_VELOCITY, ON_TIME_MS, TIMING_WINDOW_MS, type JudgeSettings } from './settings'
import { notesFor, stepsOf, type Practice, type Song, type SongNote, type Step } from './song'

export type TimingVerdict = 'early' | 'onTime' | 'late'

export interface NoteResult {
  note: SongNote
  outcome: 'hit' | 'missed'
  /** Running mode only: + is late, − early, in real ms. */
  deltaMs?: number
  timing?: TimingVerdict
}

export interface WrongNote {
  pitch: number
  atMs: number
  /** The bar she was in, for the report. */
  bar: number
}

export type JudgeEvent =
  | { type: 'hit'; result: NoteResult }
  | { type: 'missed'; result: NoteResult }
  | { type: 'wrong'; wrong: WrongNote }
  /** Wait mode: the song moved on to this step. */
  | { type: 'advance'; step: Step }
  | { type: 'done' }

export interface JudgeOptions {
  practice: Practice
  settings: JudgeSettings
  /** 1 = as written, 0.5 = half speed. Running mode only. */
  tempo?: number
  /** Added to every incoming pitch: the result of the octave check (octave.ts). */
  shift?: number
}

export interface JudgeSummary {
  results: NoteResult[]
  wrong: WrongNote[]
  total: number
  done: boolean
  mode: 'wait' | 'running'
}

/**
 * Compares what's played with what the song expects. It never draws anything
 * and never produces text: it emits events, and the feedback layer decides what
 * she sees. The same notes are judged the same way in every mode, so progress
 * stays comparable when settings change.
 *
 *  - **wait** (On a wrong note: Wait for it): the song holds on the current
 *    step until every note of it has been played; nothing is ever late.
 *  - **running** (Keep going / Show it): the song runs on a clock; each note
 *    must land within the timing window of its moment, and a note whose
 *    window passes unplayed is missed.
 */
export class Judge {
  readonly mode: 'wait' | 'running'
  private readonly steps: Step[]
  private readonly notes: SongNote[]
  private readonly results = new Map<number, NoteResult>()
  private readonly wrongNotes: WrongNote[] = []
  private readonly windowMs: number
  private readonly onTimeMs: number
  private readonly tempo: number
  private readonly shift: number
  private origin: number | null = null
  private pausedAt: number | null = null
  private stepIndex = 0
  private pending = new Set<number>()
  private finished = false

  constructor(song: Song, opts: JudgeOptions) {
    this.mode = opts.settings.onWrong === 'wait' ? 'wait' : 'running'
    this.notes = notesFor(song, opts.practice)
    this.steps = stepsOf(this.notes)
    this.windowMs = TIMING_WINDOW_MS[opts.settings.timing]
    this.onTimeMs = ON_TIME_MS[opts.settings.timing]
    this.tempo = opts.tempo ?? 1
    this.shift = opts.shift ?? 0
    this.loadStep(0)
  }

  /** Start the clock (running mode). In wait mode the song starts when the first step is played. */
  start(nowMs: number): JudgeEvent[] {
    this.origin = nowMs
    return this.notes.length === 0 ? this.finish() : []
  }

  /** Where the song is, in song ms (running) — the UI scrolls by this. */
  songTime(nowMs: number): number {
    if (this.origin === null) return 0
    return ((this.pausedAt ?? nowMs) - this.origin) * this.tempo
  }

  /**
   * Stop the clock — the keyboard disconnected, the app went to the background,
   * or she asked for a break. Nothing is missed while paused; wait mode never
   * runs a clock, so there it's a no-op.
   */
  pause(nowMs: number): void {
    if (this.mode === 'running' && this.origin !== null && this.pausedAt === null) this.pausedAt = nowMs
  }

  /** Carry on from where the song stopped, as if no time had passed. */
  resume(nowMs: number): void {
    if (this.pausedAt === null || this.origin === null) return
    this.origin += nowMs - this.pausedAt
    this.pausedAt = null
  }

  get paused(): boolean {
    return this.pausedAt !== null
  }

  /** The step being waited on (wait mode), or null once done. */
  get currentStep(): Step | null {
    return this.finished ? null : this.steps[this.stepIndex] ?? null
  }

  /** Feed one event from the MIDI layer. Accompaniment, releases and grazed keys are ignored. */
  midi(e: MidiEvent): JudgeEvent[] {
    if (e.type !== 'noteon' || !isPlayerChannel(e.channel) || e.velocity < MIN_VELOCITY) return []
    return this.press(e.note, e.time)
  }

  press(rawPitch: number, atMs: number): JudgeEvent[] {
    if (this.finished || this.pausedAt !== null) return []
    const pitch = rawPitch + this.shift
    return this.mode === 'wait' ? this.pressWait(pitch, atMs) : this.pressRunning(pitch, atMs)
  }

  /** Running mode: resolve every note whose window has passed. Call once per frame. */
  tick(nowMs: number): JudgeEvent[] {
    if (this.mode !== 'running' || this.origin === null || this.finished || this.pausedAt !== null) return []
    const events: JudgeEvent[] = []
    for (const n of this.notes) {
      if (this.results.has(n.id)) continue
      if (nowMs > this.expectedAt(n) + this.windowMs) {
        const result: NoteResult = { note: n, outcome: 'missed' }
        this.results.set(n.id, result)
        events.push({ type: 'missed', result })
      }
    }
    if (this.results.size === this.notes.length) events.push(...this.finish())
    return events
  }

  summary(): JudgeSummary {
    return {
      results: this.notes.map((n) => this.results.get(n.id)).filter((r): r is NoteResult => !!r),
      wrong: [...this.wrongNotes],
      total: this.notes.length,
      done: this.finished,
      mode: this.mode,
    }
  }

  private pressWait(pitch: number, atMs: number): JudgeEvent[] {
    const step = this.steps[this.stepIndex]
    if (!step) return []
    const expected = step.notes.find((n) => n.pitch === pitch && this.pending.has(n.id))
    if (!expected) {
      // A key of this step played again is harmless; anything else is a wrong note.
      if (step.notes.some((n) => n.pitch === pitch)) return []
      return [this.wrong(pitch, atMs, step.notes[0].bar)]
    }
    this.pending.delete(expected.id)
    const result: NoteResult = { note: expected, outcome: 'hit' }
    this.results.set(expected.id, result)
    const events: JudgeEvent[] = [{ type: 'hit', result }]
    if (this.pending.size === 0) {
      if (this.stepIndex + 1 >= this.steps.length) events.push(...this.finish())
      else {
        this.loadStep(this.stepIndex + 1)
        events.push({ type: 'advance', step: this.steps[this.stepIndex] })
      }
    }
    return events
  }

  private pressRunning(pitch: number, atMs: number): JudgeEvent[] {
    if (this.origin === null) this.origin = atMs // first key starts the song if start() wasn't called
    let best: SongNote | null = null
    let bestDelta = Infinity
    for (const n of this.notes) {
      if (n.pitch !== pitch || this.results.has(n.id)) continue
      const delta = atMs - this.expectedAt(n)
      if (Math.abs(delta) <= this.windowMs && Math.abs(delta) < Math.abs(bestDelta)) {
        best = n
        bestDelta = delta
      }
    }
    if (!best) return [this.wrong(pitch, atMs, this.barAt(this.songTime(atMs)))]
    const timing: TimingVerdict = Math.abs(bestDelta) <= this.onTimeMs ? 'onTime' : bestDelta < 0 ? 'early' : 'late'
    const result: NoteResult = { note: best, outcome: 'hit', deltaMs: Math.round(bestDelta), timing }
    this.results.set(best.id, result)
    const events: JudgeEvent[] = [{ type: 'hit', result }]
    if (this.results.size === this.notes.length) events.push(...this.finish())
    return events
  }

  private expectedAt(n: SongNote): number {
    return this.origin! + n.startMs / this.tempo
  }

  private barAt(songMs: number): number {
    let bar = 0
    for (const n of this.notes) {
      if (n.startMs > songMs) break
      bar = n.bar
    }
    return bar
  }

  private wrong(pitch: number, atMs: number, bar: number): JudgeEvent {
    const wrong = { pitch, atMs, bar }
    this.wrongNotes.push(wrong)
    return { type: 'wrong', wrong }
  }

  private loadStep(i: number) {
    this.stepIndex = i
    this.pending = new Set((this.steps[i]?.notes ?? []).map((n) => n.id))
  }

  private finish(): JudgeEvent[] {
    if (this.finished) return []
    this.finished = true
    return [{ type: 'done' }]
  }
}
