// The per-profile settings that change how a piece is judged and reported
// (KEYPATH_TUTOR.md §2). Language and note names belong to the app shell, not
// here: the engine never produces text.

export type OnWrong = 'keepGoing' | 'show' | 'wait'
export type Timing = 'relaxed' | 'normal' | 'strict'
export type ReportDepth = 'off' | 'short' | 'detailed'

export interface JudgeSettings {
  /** What she experiences on a wrong note. Only 'wait' changes how the song moves. */
  onWrong: OnWrong
  timing: Timing
  report: ReportDepth
  wrongAffectsStars: boolean
}

/**
 * Confidence first: a new player starts where nothing can go wrong in time —
 * the song waits for each note — and never loses stars for a wrong key.
 */
export const DEFAULT_SETTINGS: JudgeSettings = {
  onWrong: 'wait',
  timing: 'relaxed',
  report: 'short',
  wrongAffectsStars: false,
}

/**
 * How far from its moment a note may land and still count, ± ms. Relaxed is
 * deliberately generous: early and late never cost anything there, they are
 * only noted. Tune on Nora — these are starting values, not measurements.
 */
export const TIMING_WINDOW_MS: Record<Timing, number> = {
  relaxed: 350,
  normal: 200,
  strict: 110,
}

/** Within this, a note counts as on time rather than early/late. */
export const ON_TIME_MS: Record<Timing, number> = {
  relaxed: 150,
  normal: 90,
  strict: 50,
}

/**
 * A key barely touched isn't a played note: on the S24 a grazed key arrived at
 * velocity 1 in the middle of a glissando (KEYPATH.md §1).
 */
export const MIN_VELOCITY = 5

/**
 * Progression, never automatic: once a piece goes well, the next rung up is
 * *suggested*, one setting at a time (KEYPATH_TUTOR.md §2, "The ramp"):
 *
 *   1. Wait for it            the notes, with no clock
 *   2. Show it   · relaxed    playing in time, mistakes shown
 *   3. Show it   · normal     tighter timing
 *   4. Keep going · normal    a performance: nothing live, a report at the end
 *   5. Keep going · strict    polish
 *
 * Timing is stepped up before the next mode, so each rung changes one thing.
 * From anywhere off the ladder (set by hand), the next useful change is
 * suggested. Speed (50–100%) and hands are chosen per song, not here.
 */
export type NextStep = { setting: 'onWrong'; to: OnWrong } | { setting: 'timing'; to: Timing }

export function nextStep(s: Pick<JudgeSettings, 'onWrong' | 'timing'>): NextStep | null {
  switch (s.onWrong) {
    case 'wait':
      return { setting: 'onWrong', to: 'show' }
    case 'show':
      return s.timing === 'relaxed' ? { setting: 'timing', to: 'normal' } : { setting: 'onWrong', to: 'keepGoing' }
    case 'keepGoing':
      return s.timing === 'relaxed' ? { setting: 'timing', to: 'normal' } : s.timing === 'normal' ? { setting: 'timing', to: 'strict' } : null
  }
}
