import { useEffect } from 'react'

// A silent, looping 0.1s WAV. Browsers only surface a Media Session's
// lock-screen / headset / smartwatch transport controls while some media
// element is actively playing — this gives them one to hang the controls
// off, without making any sound. Shared across the app; there's only ever
// one Player mounted at a time.
const SILENT_WAV =
  'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA=='

let sharedAudio = null
function getSilentAudio() {
  if (typeof Audio === 'undefined') return null
  if (!sharedAudio) {
    sharedAudio = new Audio(SILENT_WAV)
    sharedAudio.loop = true
  }
  return sharedAudio
}

// Lock-screen / Bluetooth-headset / smartwatch transport controls, so Pause,
// Resume and Skip work without touching (or even unlocking) the phone —
// useful with it in an armband or a jersey pocket. Purely additive: does
// nothing on browsers without the Media Session API, and any failure (e.g.
// autoplay blocked) degrades silently back to on-screen controls only.
export function useMediaSession({ active, title, artist, status, onPlay, onPause, onNext }) {
  const supported = typeof navigator !== 'undefined' && 'mediaSession' in navigator

  useEffect(() => {
    if (!active || !supported) return undefined

    const audio = getSilentAudio()
    audio?.play().catch(() => {})

    navigator.mediaSession.setActionHandler('play', onPlay)
    navigator.mediaSession.setActionHandler('pause', onPause)
    navigator.mediaSession.setActionHandler('nexttrack', onNext)

    return () => {
      navigator.mediaSession.setActionHandler('play', null)
      navigator.mediaSession.setActionHandler('pause', null)
      navigator.mediaSession.setActionHandler('nexttrack', null)
      audio?.pause()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, supported, onPlay, onPause, onNext])

  useEffect(() => {
    if (!active || !supported || typeof MediaMetadata === 'undefined') return
    navigator.mediaSession.metadata = new MediaMetadata({ title, artist, album: 'Tempo' })
  }, [active, supported, title, artist])

  useEffect(() => {
    if (!active || !supported) return
    navigator.mediaSession.playbackState = status === 'running' ? 'playing' : status === 'paused' ? 'paused' : 'none'
  }, [active, supported, status])
}
