import { useState, useEffect } from 'react'
// Can't throw — an unguarded setItem here (Safari private mode, quota) would have
// escaped from a React effect and taken the whole app down.
import { readJson, writeJson } from '../../shared/storage'

const CONFIG_KEY = 'lexi5_config'

const DEFAULT_CONFIG = {
  theme: null, // null = system, 'light', 'dark'
  difficulty: 'normal', // 'normal', 'hard'
  dictionary: 'standard', // 'lite', 'standard', 'expanded', 'expert', 'custom'
  smartKeyboard: false, // true to show dots on yellow keys
  // Must be declared here even though it defaults to off: the Settings toggle binds
  // `checked` straight to it, and an undefined `checked` makes that input uncontrolled
  // until first use, which React warns about the moment it becomes controlled.
  highContrast: false, // true for the blue/orange colour-vision-friendly palette
}

export function useConfig() {
  const [config, setConfig] = useState(() => {
    const stored = readJson(CONFIG_KEY, null)
    return stored ? { ...DEFAULT_CONFIG, ...stored } : DEFAULT_CONFIG
  })

  useEffect(() => {
    writeJson(CONFIG_KEY, config)
    
    // Apply theme to document
    const dark = config.theme 
      ? config.theme === 'dark' 
      : matchMedia('(prefers-color-scheme: dark)').matches
    
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  }, [config])

  const updateConfig = (updates) => {
    setConfig(prev => ({ ...prev, ...updates }))
  }

  return { config, updateConfig }
}
