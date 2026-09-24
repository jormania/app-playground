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

/** Confidence first: see the wrong key, never be stopped, never lose stars for it. */
export const DEFAULT_SETTINGS: JudgeSettings = {
  onWrong: 'show',
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
 * Progression, never automatic: once a piece goes well in the current setting,
 * the next one up is *suggested*. Keep going → Show it → Wait for it, and
 * relaxed → normal → strict timing.
 */
export const NEXT_ON_WRONG: Record<OnWrong, OnWrong | null> = { keepGoing: 'show', show: 'wait', wait: null }
export const NEXT_TIMING: Record<Timing, Timing | null> = { relaxed: 'normal', normal: 'strict', strict: null }
