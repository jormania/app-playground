import { useEffect } from 'react'

// A silent, looping 0.1s WAV. Browsers only surface a Media Session's
// lock-screen / headset / smartwatch transport controls — and, on Android
// Chrome, exempt the page from background-tab power-saving throttling —
// while some media element is actively "playing". This gives them one to
// hang the controls (and that background-audio exemption) off, without
// making any sound of its own.
//
// Promoted here from Tempo once Yoru also needed it: Tempo uses it for its
// on-screen timer's lock-screen transport controls; Yoru uses it purely to
// keep its synthesised night soundscape from being throttled/suspended once
// the screen locks (see src/yoru/components/Session.jsx). Tempo's own
// src/tempo/lib/mediaSession.js is now a thin re-export of this file.
const SILENT_WAV =
  'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA='

let sharedAudio = null
function getSilentAudio() {
  if (typeof Audio === 'undefined') return null
  if (!sharedAudio) {
    sharedAudio = new Audio(SILENT_WAV)
    sharedAudio.loop = true
  }
  return sharedAudio
}

// `actions`: { play, pause, stop, nexttrack, previoustrack } — each optional;
// an action left out is unset (passed `null`), so the OS hides/disables that
// control rather than showing a dead button.
//
// Purely additive: does nothing on browsers without the Media Session API,
// and any failure (e.g. autoplay blocked) degrades silently back to
// foreground-only behaviour.
export function useMediaSession({ active, title, artist, album, status, actions = {} }) {
  const supported = typeof navigator !== 'undefined' && 'mediaSession' in navigator
  const { play, pause, stop, nexttrack, previoustrack } = actions

  useEffect(() => {
    if (!active || !supported) return undefined

    const audio = getSilentAudio()
    audio?.play().catch(() => {})

    navigator.mediaSession.setActionHandler('play', play ?? null)
    navigator.mediaSession.setActionHandler('pause', pause ?? null)
    navigator.mediaSession.setActionHandler('stop', stop ?? null)
    navigator.mediaSession.setActionHandler('nexttrack', nexttrack ?? null)
    navigator.mediaSession.setActionHandler('previoustrack', previoustrack ?? null)

    return () => {
      navigator.mediaSession.setActionHandler('play', null)
      navigator.mediaSession.setActionHandler('pause', null)
      navigator.mediaSession.setActionHandler('stop', null)
      navigator.mediaSession.setActionHandler('nexttrack', null)
      navigator.mediaSession.setActionHandler('previoustrack', null)
      audio?.pause()
    }
  }, [active, supported, play, pause, stop, nexttrack, previoustrack])

  useEffect(() => {
    if (!active || !supported || typeof MediaMetadata === 'undefined') return
    navigator.mediaSession.metadata = new MediaMetadata({ title, artist, album })
  }, [active, supported, title, artist, album])

  useEffect(() => {
    if (!active || !supported) return
    navigator.mediaSession.playbackState = status === 'running' ? 'playing' : status === 'paused' ? 'paused' : 'none'
  }, [active, supported, status])
}
