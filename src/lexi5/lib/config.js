import { useState, useEffect } from 'react'

const CONFIG_KEY = 'lexi5_config'

const DEFAULT_CONFIG = {
  theme: null, // null = system, 'light', 'dark'
  difficulty: 'normal', // 'normal', 'hard'
  dictionary: 'standard', // 'standard', 'expanded', 'expert'
  smartKeyboard: false, // true to show dots on yellow keys
}

export function useConfig() {
  const [config, setConfig] = useState(() => {
    try {
      const stored = localStorage.getItem(CONFIG_KEY)
      return stored ? { ...DEFAULT_CONFIG, ...JSON.parse(stored) } : DEFAULT_CONFIG
    } catch {
      return DEFAULT_CONFIG
    }
  })

  useEffect(() => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
    
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
