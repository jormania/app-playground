import { useState, useEffect } from 'react'
// Can't throw — an unguarded setItem here (Safari private mode, quota) would have
// escaped from a React effect and taken the whole app down.
import { readJson, writeJson } from '../../shared/storage'

const CONFIG_KEY = 'lexi5_config'

export type ThemeChoice = 'light' | 'dark' | null
export type Difficulty = 'normal' | 'hard'
export type DictionaryKey = 'lite' | 'standard' | 'expanded' | 'expert' | 'custom'

/**
 * Every persisted preference. Declaring this as a closed shape is what stops a new
 * setting from being read by a component before it exists in DEFAULT_CONFIG — which is
 * exactly how the High Contrast toggle shipped as an uncontrolled input.
 */
export interface Config {
  theme: ThemeChoice
  difficulty: Difficulty
  dictionary: DictionaryKey
  smartKeyboard: boolean
  highContrast: boolean
}

const DEFAULT_CONFIG: Config = {
  theme: null, // null = system, 'light', 'dark'
  difficulty: 'normal', // 'normal', 'hard'
  dictionary: 'standard', // 'lite', 'standard', 'expanded', 'expert', 'custom'
  smartKeyboard: false, // true to show dots on yellow keys
  // Must be declared here even though it defaults to off: the Settings toggle binds
  // `checked` straight to it, and an undefined `checked` makes that input uncontrolled
  // until first use, which React warns about the moment it becomes controlled.
  highContrast: false, // true for the blue/orange colour-vision-friendly palette
}

export function useConfig(): { config: Config; updateConfig: (updates: Partial<Config>) => void } {
  const [config, setConfig] = useState<Config>(() => {
    const stored = readJson<Partial<Config> | null>(CONFIG_KEY, null)
    return stored ? { ...DEFAULT_CONFIG, ...stored } : DEFAULT_CONFIG
  })

  useEffect(() => {
    writeJson(CONFIG_KEY, config)

    const query = matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = config.theme ? config.theme === 'dark' : query.matches
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
    }
    apply()

    // With theme set to "system", the OS can flip underneath a running tab (phones
    // schedule dark mode at sunset). Reading matchMedia once left that tab on the old
    // theme until reload, so follow the query for as long as we're deferring to it.
    if (config.theme) return undefined
    query.addEventListener('change', apply)
    return () => query.removeEventListener('change', apply)
  }, [config])

  const updateConfig = (updates: Partial<Config>) => {
    setConfig(prev => ({ ...prev, ...updates }))
  }

  return { config, updateConfig }
}
