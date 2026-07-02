let audioCtx = null

function getContext() {
  if (typeof window === 'undefined') return null
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  if (!audioCtx) audioCtx = new Ctx()
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {})
  return audioCtx
}

function beep({ frequency, duration, delay = 0, volume = 0.2 }) {
  const ctx = getContext()
  if (!ctx) return
  const startAt = ctx.currentTime + delay
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.value = frequency
  gain.gain.setValueAtTime(volume, startAt)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.start(startAt)
  oscillator.stop(startAt + duration)
}

export function playTransitionCue() {
  beep({ frequency: 880, duration: 0.15 })
}

export function playCompletionCue() {
  beep({ frequency: 660, duration: 0.15 })
  beep({ frequency: 880, duration: 0.15, delay: 0.18 })
  beep({ frequency: 1046, duration: 0.25, delay: 0.36 })
}
