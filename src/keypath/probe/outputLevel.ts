import { readJson, writeJson } from '../../shared/storage'

/**
 * How loud KeyPath's own sound is while the real keyboard is connected.
 *
 * With the cable in, Android may send the phone's audio to the PSR-E383's
 * speakers (its USB port is also a sound card). The keyboard's own setting for
 * that, Function 045 "[USB TO HOST] Audio Volume", can't be changed from an
 * app: the PSR-E383's MIDI Data Format documents no message for it. So the app
 * controls the other end, its own output, and starts at 0 so nothing reaches
 * the keyboard until someone chooses it.
 */
export interface OutputLevel {
  /** 0–100. 0 means KeyPath sends no sound at all. */
  level: number
  /** The level to restore when toggled back on. */
  lastLevel: number
}

export const DEFAULT_OUTPUT: OutputLevel = { level: 0, lastLevel: 50 }
const KEY = 'keypath:keyboard-output'

const clamp = (n: number) => Math.round(Math.min(100, Math.max(0, Number.isFinite(n) ? n : 0)))

export function loadOutputLevel(): OutputLevel {
  const raw = readJson<Partial<OutputLevel> | null>(KEY, null)
  if (!raw) return DEFAULT_OUTPUT
  const level = clamp(raw.level ?? 0)
  const lastLevel = clamp(raw.lastLevel ?? DEFAULT_OUTPUT.lastLevel) || DEFAULT_OUTPUT.lastLevel
  return { level, lastLevel }
}

export function saveOutputLevel(value: OutputLevel): void {
  writeJson(KEY, value)
}

export function withLevel(state: OutputLevel, level: number): OutputLevel {
  const next = clamp(level)
  return { level: next, lastLevel: next > 0 ? next : state.lastLevel }
}

/** Off → back to the last level used; on → 0. */
export function toggled(state: OutputLevel): OutputLevel {
  return state.level > 0 ? { ...state, level: 0 } : { ...state, level: state.lastLevel }
}

/** Slider position to gain. Squared, because loudness is heard roughly logarithmically. */
export function gainFor(level: number): number {
  return (clamp(level) / 100) ** 2
}
