import { gainFor, loadOutputLevel } from './outputLevel'

let ctx: AudioContext | null = null
let keyboardBus: GainNode | null = null
// The level saved on this phone, from the start: it used to begin at 0 and be
// set only when Diagnostics opened, so after a reload the phone played silently
// through the keyboard at any saved level, and nothing said why.
let keyboardGain = gainFor(loadOutputLevel().level)

/**
 * One AudioContext for the whole page, created lazily and resumed on demand.
 * Chrome only lets a context start after a user gesture, so call this from a
 * tap or key press, never at load.
 */
export async function audioContext(): Promise<AudioContext> {
  ctx ??= new AudioContext({ latencyHint: 'interactive' })
  if (ctx.state === 'suspended') await ctx.resume()
  return ctx
}

/**
 * How long after it is played the phone's own sound reaches her ears, as the
 * browser reports it (the output's latency and the context's own), in ms; 0
 * before anything has played or where the browser doesn't say. Capped, so a
 * wild figure can't throw timing off further than the delay itself would.
 */
export function phoneLatencyMs(c: Pick<AudioContext, 'outputLatency' | 'baseLatency'> | null = ctx): number {
  if (!c) return 0
  const s = (Number.isFinite(c.outputLatency) ? c.outputLatency : 0) + (Number.isFinite(c.baseLatency) ? c.baseLatency : 0)
  return Math.round(Math.min(0.3, Math.max(0, s)) * 1000)
}

/**
 * Where everything KeyPath plays with the real keyboard connected goes: a
 * single gain stage that the "Sound through the keyboard" control owns. A
 * future metronome or backing track connects here, never straight to
 * `destination`, so the level (default 0) always applies.
 */
export async function keyboardOutput(): Promise<GainNode> {
  const c = await audioContext()
  if (!keyboardBus) {
    keyboardBus = c.createGain()
    keyboardBus.gain.value = keyboardGain
    keyboardBus.connect(c.destination)
  }
  return keyboardBus
}

/** The gain KeyPath's sound through the keyboard is played at now (0–1). */
export const currentKeyboardGain = () => keyboardGain

/** Apply a 0–100 level. Safe to call before any audio exists; it's remembered. */
export function setKeyboardLevel(level: number): void {
  keyboardGain = gainFor(level)
  if (keyboardBus && ctx) keyboardBus.gain.setTargetAtTime(keyboardGain, ctx.currentTime, 0.02)
}
