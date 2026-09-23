import { gainFor } from './outputLevel'

let ctx: AudioContext | null = null
let keyboardBus: GainNode | null = null
let keyboardGain = 0

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

/** Apply a 0–100 level. Safe to call before any audio exists; it's remembered. */
export function setKeyboardLevel(level: number): void {
  keyboardGain = gainFor(level)
  if (keyboardBus && ctx) keyboardBus.gain.setTargetAtTime(keyboardGain, ctx.currentTime, 0.02)
}
