import type { JudgeSummary, Song } from '../../engine'

// Practising one bar (KEYPATH_TUTOR.md §10, "Learning curve"): the report's
// "Bar 5 is worth another go" becomes a loop of that bar alone. With a clock
// (Show it, Keep going) it climbs a speed ladder, 50% → 75% → 100%, one clean
// pass per rung, never above the speed she played the song at. In "Wait for
// it" there is no clock to speed up, so one clean pass finishes it. Free of
// React, like the engine.

/** The rungs, slowest first. */
export const LADDER = [0.5, 0.75, 1] as const

export interface Loop {
  /** 0-based, as the engine counts. */
  bar: number
  /** Tempos to climb, slowest first; the last is where the loop ends. */
  rungs: number[]
  rung: number
  passes: number
}

/** 'again': not clean, the same rung once more. 'up': clean, one rung faster. 'done': clean at the top. */
export type LoopStep = 'again' | 'up' | 'done'

/** One bar of the song on its own, moved to start at 0; null if the bar has no notes. */
export function barSong(song: Song, bar: number): Song | null {
  const inBar = song.notes.filter((n) => n.bar === bar)
  if (inBar.length === 0) return null
  const from = Math.min(...inBar.map((n) => n.startMs))
  const notes = inBar.map((n) => ({ ...n, startMs: n.startMs - from }))
  return { ...song, id: `${song.id}#bar${bar + 1}`, notes, durationMs: Math.max(...notes.map((n) => n.startMs + n.durationMs)) }
}

export function startLoop(bar: number, mode: 'wait' | 'running', songTempo: number): Loop {
  const climb = LADDER.filter((s) => s <= songTempo + 1e-9)
  const rungs = mode === 'wait' || climb.length === 0 ? [songTempo] : climb
  return { bar, rungs, rung: 0, passes: 0 }
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
