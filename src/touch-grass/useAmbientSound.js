import { useEffect, useRef, useCallback } from 'react'
import { createAmbience } from './ambientAudio.js'
import { useWorld } from './world.jsx'

// Wires the vanilla audio engine to React. The bed is driven entirely by the
// user's mix (the Chorus); only the light day/night gating of the voices reads
// the world (time of day, season, meteor nights).
export function useAmbientSound(enabled, mix, stereo = true, voicesOn = true) {
  const ref = useRef(null)
  const { timeOfDay, season, moments } = useWorld()
  const meteor = (moments || []).some(m => m.meteor)

  // create the engine once; resume + tap on gesture; dispose on unmount
  useEffect(() => {
    const eng = createAmbience()
    ref.current = eng
    const onPointer = (e) => {
      eng.resume()
      if (e.target.closest && e.target.closest('button')) eng.tap()
    }
    const onKey = () => eng.resume()
    window.addEventListener('pointerdown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointer)
      window.removeEventListener('keydown', onKey)
      eng.dispose()
      ref.current = null
    }
  }, [])

  // the mix (the Chorus) — layers, shapers, voice levels. Set before enabling is
  // fine; the engine holds it and applies it on enable.
  useEffect(() => {
    if (ref.current && mix) ref.current.setMix(mix)
  }, [mix])

  // light world context for the voices' day/night appropriateness
  useEffect(() => {
    if (ref.current) ref.current.setWorld({ timeOfDay, season, meteor })
  }, [timeOfDay, season, meteor])

  // bed stereo width (a settings toggle). Declared before the enable effect so
  // the flag is set before the first build — no wasteful rebuild on mount.
  useEffect(() => {
    if (ref.current) ref.current.setStereo(stereo)
  }, [stereo])

  // the one-shot voices on/off (live)
  useEffect(() => {
    if (ref.current) ref.current.setVoices(voicesOn)
  }, [voicesOn])

  // mute / unmute
  useEffect(() => {
    if (ref.current) ref.current.setEnabled(enabled)
  }, [enabled])

  const reveal = useCallback(() => ref.current?.reveal(), [])
  const depart = useCallback(() => ref.current?.depart(), [])
  return { reveal, depart }
}
