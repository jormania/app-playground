import { useEffect, useRef, useCallback } from 'react'
import { createAmbience, sceneFor } from './ambientAudio.js'
import { useWorld } from './world.jsx'

export function useAmbientSound(enabled) {
  const ref = useRef(null)
  const { timeOfDay, season, weather, biome, soloBiome, moments } = useWorld()
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

  // follow the world's time-of-day / season scene
  useEffect(() => {
    if (ref.current) ref.current.setScene(sceneFor(timeOfDay, season))
  }, [timeOfDay, season])

  // exact phase (dawn chorus / dusk wind-down) and season (cuckoo, wolf…)
  useEffect(() => {
    if (ref.current) ref.current.setPhase(timeOfDay)
  }, [timeOfDay])
  useEffect(() => {
    if (ref.current) ref.current.setSeason(season)
  }, [season])

  // meteor-shower nights unlock the shooting-star shimmer
  useEffect(() => {
    if (ref.current) ref.current.setMeteor(meteor)
  }, [meteor])

  // follow live weather (rain bed, thunder, wind level)
  useEffect(() => {
    if (ref.current) ref.current.setWeather(weather)
  }, [weather])

  // follow the coarse biome (surf, traffic, thin wind, leaf-rustle, gulls)
  useEffect(() => {
    if (ref.current) ref.current.setBiome(biome)
  }, [biome])

  // ?solo — mute everything but the biome bed, for auditioning each biome
  useEffect(() => {
    if (ref.current) ref.current.setSolo(soloBiome)
  }, [soloBiome])

  // mute / unmute
  useEffect(() => {
    if (ref.current) ref.current.setEnabled(enabled)
  }, [enabled])

  const reveal = useCallback(() => ref.current?.reveal(), [])
  const depart = useCallback(() => ref.current?.depart(), [])
  return { reveal, depart }
}
