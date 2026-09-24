import type { Timing } from '../../engine'

// Rhythm echo (door C): KeyPath plays one bar, she plays it back on any key.
// Only *when* matters, so every note is the same pitch and any key counts.
// Patterns are in beats of a 4/4 bar, 0 to <4.

export type EchoLevel = 1 | 2 | 3

export const ECHO_PATTERNS: Record<EchoLevel, number[][]> = {
  // Quarter notes and rests.
  1: [
    [0, 1, 2, 3],
    [0, 1, 2],
    [0, 2, 3],
    [0, 1, 3],
    [0, 2],
  ],
  // Eighth notes join in.
  2: [
    [0, 1, 1.5, 2, 3],
    [0, 0.5, 1, 2, 3],
    [0, 1, 2, 2.5, 3],
    [0, 0.5, 1, 1.5, 2],
    [0, 1, 2, 3, 3.5],
  ],
  // Off the beat.
  3: [
    [0, 1.5, 2, 3],
    [0, 0.5, 1.5, 2, 3],
    [0, 1, 1.5, 2.5, 3],
    [0.5, 1, 2, 3],
    [0, 1.5, 2.5, 3],
  ],
}

export const ECHO_BPM: Record<EchoLevel, number> = { 1: 80, 2: 80, 3: 76 }

/** How far a tap may land from its beat and still count, ± ms, by her Timing setting. */
export const ECHO_WINDOW_MS: Record<Timing, number> = { relaxed: 140, normal: 100, strict: 65 }
/** Within this, a tap is on time rather than early or late. */
export const ECHO_ON_TIME_MS: Record<Timing, number> = { relaxed: 70, normal: 50, strict: 35 }

export const beatMs = (bpm: number) => 60000 / bpm

/**
 * One turn, as a timeline from `start`: four count-in clicks, the pattern,
 * four more clicks, then her bar (silent). Times are absolute ms.
 */
export function turnTimeline(pattern: number[], bpm: number, start: number) {
  const b = beatMs(bpm)
  const clicks = (from: number) => [0, 1, 2, 3].map((i) => ({ at: from + i * b, accent: i === 0 }))
  return {
    listenClicks: clicks(start),
    notes: pattern.map((beat) => start + 4 * b + beat * b),
    yourClicks: clicks(start + 8 * b),
    /** Her bar's first beat. */
    downbeat: start + 12 * b,
    /** When the turn is over: her bar, plus room for a late last tap. */
    end: start + 16 * b,
  }
}

export type TapMark = { beat: number; deltaMs: number | null; verdict: 'onTime' | 'early' | 'late' | 'missed' }

export interface EchoResult {
  marks: TapMark[]
  /** Taps that matched no note. */
  extra: number
  passed: boolean
}

/**
 * Match her taps to the pattern: each note takes the nearest unused tap within
 * the window. She passes with every note played and at most one stray tap —
 * a nervous double-tap isn't a failed rhythm.
 */
export function judgeEcho(pattern: number[], bpm: number, downbeat: number, taps: number[], timing: Timing): EchoResult {
  const b = beatMs(bpm)
  const window = ECHO_WINDOW_MS[timing]
  const onTime = ECHO_ON_TIME_MS[timing]
  const free = [...taps].sort((x, y) => x - y)
  const used = new Set<number>()
  const marks: TapMark[] = pattern.map((beat) => {
    const at = downbeat + beat * b
    let best = -1
    for (let i = 0; i < free.length; i++) {
      if (used.has(i) || Math.abs(free[i] - at) > window) continue
      if (best === -1 || Math.abs(free[i] - at) < Math.abs(free[best] - at)) best = i
    }
    if (best === -1) return { beat, deltaMs: null, verdict: 'missed' }
    used.add(best)
    const delta = Math.round(free[best] - at)
    return { beat, deltaMs: delta, verdict: Math.abs(delta) <= onTime ? 'onTime' : delta < 0 ? 'early' : 'late' }
  })
  const extra = free.length - used.size
  return { marks, extra, passed: marks.every((m) => m.verdict !== 'missed') && extra <= 1 }
}
