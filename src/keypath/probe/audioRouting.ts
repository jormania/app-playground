// The PSR-E383's USB TO HOST port is a USB audio interface as well as a MIDI
// one (44.1 kHz / 16-bit stereo, per its spec sheet). Android usually moves
// media audio to a USB audio device the moment one appears, so the phone's
// sound can start coming out of the keyboard's speakers.
//
// A web page can't choose where Android sends its audio: HTMLMediaElement's
// setSinkId is unavailable on Android (MDN: "Not available due to a limitation
// in Android"), and without microphone permission enumerateDevices hides the
// device list. So the probe settles it the only reliable way: play a tone and
// ask where it was heard. The fixes themselves are settings (see KEYPATH.md).

import { audioContext, keyboardOutput } from './audioContext'

export type HeardFrom = 'keyboard' | 'phone' | 'both' | 'nowhere'

export interface AudioDeviceView {
  outputs: number
  inputs: number
  /** Empty strings unless the page holds microphone permission — Chrome masks them. */
  labels: string[]
}

export interface ToneResult {
  /** AudioContext.baseLatency, ms — the context's own processing buffer. */
  baseLatencyMs: number | null
  /** AudioContext.outputLatency, ms — the OS's estimate from context to the speaker. */
  outputLatencyMs: number | null
  error: string | null
}

export async function readAudioDevices(): Promise<AudioDeviceView | null> {
  try {
    const all = await navigator.mediaDevices.enumerateDevices()
    return {
      outputs: all.filter((d) => d.kind === 'audiooutput').length,
      inputs: all.filter((d) => d.kind === 'audioinput').length,
      labels: all.filter((d) => d.kind !== 'videoinput').map((d) => d.label).filter(Boolean),
    }
  } catch {
    return null
  }
}

/** Calls back with a fresh device view whenever the OS reports a change. */
export function watchAudioDevices(onChange: (view: AudioDeviceView | null) => void): () => void {
  const md = typeof navigator === 'undefined' ? undefined : navigator.mediaDevices
  if (!md?.addEventListener) return () => {}
  const handler = () => {
    readAudioDevices().then(onChange)
  }
  md.addEventListener('devicechange', handler)
  return () => md.removeEventListener('devicechange', handler)
}

/**
 * A short two-note chime, loud enough to locate, soft enough not to startle.
 * Must run from a tap: Chrome only starts an AudioContext after a user gesture.
 * The context is shared with the simulator's synth, so the latency figures
 * describe the same audio path the simulator uses.
 */
export async function playTestTone(): Promise<ToneResult> {
  return playChime('test')
}

/** The same chime through the keyboard-output level, so the chosen volume can be heard. */
export async function previewKeyboardOutput(): Promise<ToneResult> {
  return playChime('keyboard')
}

// The test tone deliberately bypasses the keyboard-output level: its job is to
// find out where the phone's audio goes, which it can't do at volume 0.
async function playChime(route: 'test' | 'keyboard'): Promise<ToneResult> {
  try {
    const ctx = await audioContext()
    const out: AudioNode = route === 'keyboard' ? await keyboardOutput() : ctx.destination
    const t0 = ctx.currentTime + 0.05
    for (const [i, freq] of [523.25, 659.25].entries()) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.frequency.value = freq
      const start = t0 + i * 0.35
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.3, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.6)
      osc.connect(gain).connect(out)
      osc.start(start)
      osc.stop(start + 0.65)
    }
    const toMs = (s: number | undefined) => (typeof s === 'number' && Number.isFinite(s) ? Math.round(s * 10000) / 10 : null)
    return { baseLatencyMs: toMs(ctx.baseLatency), outputLatencyMs: toMs(ctx.outputLatency), error: null }
  } catch (err) {
    return { baseLatencyMs: null, outputLatencyMs: null, error: err instanceof Error ? `${err.name}: ${err.message}` : String(err) }
  }
}

export interface AudioAdvice {
  headline: string
  steps: string[]
}

/** What to do about where the sound went. Pure, so the copy is testable. */
export function adviceFor(heard: HeardFrom): AudioAdvice {
  switch (heard) {
    case 'keyboard':
      return {
        headline: 'Android is sending the phone’s audio to the Yamaha’s speakers.',
        steps: [
          'KeyPath’s own sound is already covered: the “KeyPath sound through the keyboard” level above starts at 0.',
          'To silence everything else the phone plays (notifications, other apps), on the keyboard: FUNCTION → 045 “[USB TO HOST] Audio Volume” → 0. The keyboard remembers this after power-off, and MIDI is unaffected.',
          'Or from the phone: Settings → Developer options → “Disable USB audio routing”. This affects every USB audio device, USB-C earphones included.',
          'Also set FUNCTION → 046 “Audio Loop Back” to Off if anything is ever recorded, so the phone’s sound isn’t sent back to it.',
        ],
      }
    case 'both':
      return {
        headline: 'You heard it from both, or couldn’t tell.',
        steps: [
          'Turn the keyboard’s volume right down and play the tone again. If it disappears, the audio is going to the keyboard.',
        ],
      }
    case 'phone':
      return {
        headline: 'The phone kept its own audio. Nothing to fix.',
        steps: ['The keyboard’s speakers only play what you play on it.'],
      }
    case 'nowhere':
      return {
        headline: 'No sound at all.',
        steps: [
          'Check the phone’s media volume (not ringtone volume).',
          'If audio went to the keyboard, FUNCTION → 045 may already be at 0, which mutes it. That is a fine state to leave it in.',
        ],
      }
  }
}
