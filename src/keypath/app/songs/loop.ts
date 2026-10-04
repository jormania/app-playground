import type { JudgeSummary, Song, SongNote } from '../../engine'
import { rangeSong } from './parts'

// Practising a bar, or a stretch of bars (KEYPATH_TUTOR.md §10, "Learning
// curve"): the report's "Bar 5 is worth another go" becomes a loop of that bar
// alone, and the setup can loop any run of bars, from one to another. With a clock
// (Show it, Keep going) it climbs a speed ladder, 50% → 75% → 100%, one clean
// pass per rung, never above the speed she played the song at. In "Wait for
// it" there is no clock to speed up, so one clean pass finishes it. Free of
// React, like the engine.

/** The rungs, slowest first. */
export const LADDER = [0.5, 0.75, 1] as const

export interface Loop {
  /** The first bar, 0-based, as the engine counts. */
  bar: number
  /** One past the last bar: `bar + 1` for a single bar. */
  to: number
  /** Tempos to climb, slowest first; the last is where the loop ends. */
  rungs: number[]
  rung: number
  passes: number
}

/** 'again': not clean, the same rung once more. 'up': clean, one rung faster. 'done': clean at the top. */
export type LoopStep = 'again' | 'up' | 'done'

/** Bars [bar, to) of the song on their own, moved to start at 0; null if there are no notes there. */
export const barSong = (song: Song, bar: number, to = bar + 1): Song | null =>
  rangeSong(song, bar, to, to - bar > 1 ? `${song.id}#bars${bar + 1}-${to}` : `${song.id}#bar${bar + 1}`)

/** A loop of bars [bar, to): one bar unless `to` says more. */
export function startLoop(bar: number, mode: 'wait' | 'running', songTempo: number, to = bar + 1): Loop {
  const climb = LADDER.filter((s) => s <= songTempo + 1e-9)
  const rungs = mode === 'wait' || climb.length === 0 ? [songTempo] : climb
  return { bar, to: Math.max(to, bar + 1), rungs, rung: 0, passes: 0 }
}

/** Every note played, none missed, no wrong key. */
export function isClean(s: JudgeSummary): boolean {
  return s.done && s.wrong.length === 0 && s.results.length === s.total && s.results.every((r) => r.outcome === 'hit')
}

export function afterPass(loop: Loop, clean: boolean): { loop: Loop; step: LoopStep } {
  const passes = loop.passes + 1
  if (!clean) return { loop: { ...loop, passes }, step: 'again' }
  if (loop.rung < loop.rungs.length - 1) return { loop: { ...loop, passes, rung: loop.rung + 1 }, step: 'up' }
  return { loop: { ...loop, passes }, step: 'done' }
}

export const tempoOf = (loop: Loop) => loop.rungs[loop.rung]

/**
 * The bars there is something to practise in, for the hands being played:
 * a bar with no note starting in it (a rest, a note tied over, the other
 * hand's bar) would loop nothing. A pickup (bar 0, as printed) goes with the
 * bar after it, so it isn't offered on its own when there's more.
 */
export function playableBars(notes: readonly Pick<SongNote, 'bar'>[], pickup = false): number[] {
  const bars = [...new Set(notes.map((n) => n.bar))].sort((a, b) => a - b)
  return pickup && bars.length > 1 ? bars.filter((b) => b > 0) : bars
}

/** A stretch of bars, [from, to), 0-based: `to` is one past the last. */
export interface BarRange {
  from: number
  to: number
}

/**
 * Where a stretch starting at `from` ends (its last bar): the playable bar
 * nearest `pick`, looking forward first, and never one before `from`.
 */
export function stretchEnd(playable: readonly number[], from: number, pick: number): number {
  return nearestPlayable(playable.filter((b) => b >= from), Math.max(pick, from)) ?? from
}

/** The playable bar nearest to `bar`, looking forward first; null when there's none. */
export function nearestPlayable(playable: readonly number[], bar: number): number | null {
  return playable.find((b) => b >= bar) ?? playable[playable.length - 1] ?? null
}
