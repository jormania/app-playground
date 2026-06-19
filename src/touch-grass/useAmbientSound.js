import { useEffect, useRef, useCallback } from 'react'
import { getTimeOfDay, getSeason } from './context.js'
import { createAmbience, sceneFor } from './ambientAudio.js'

export function useAmbientSound(enabled) {
  const ref = useRef(null)

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

  // follow the time-of-day / season scene, re-checked once a minute
  useEffect(() => {
    const eng = ref.current
    if (!eng) return
    const update = () => {
      const now = new Date()
      eng.setScene(sceneFor(getTimeOfDay(now), getSeason(now)))
    }
    update()
    const id = setInterval(update, 60_000)
    return () => clearInterval(id)
  }, [])

  // mute / unmute
  useEffect(() => {
    if (ref.current) ref.current.setEnabled(enabled)
  }, [enabled])

  const reveal = useCallback(() => ref.current?.reveal(), [])
  const depart = useCallback(() => ref.current?.depart(), [])
  return { reveal, depart }
}
