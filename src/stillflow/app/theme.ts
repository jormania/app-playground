import { useEffect } from 'react'
import { writeJson } from '../../shared/storage'
import type { Preferences } from '../domain/types'

/** Read by stillflow-react.html before first paint, so a dark choice never flashes ivory. */
export const THEME_KEY = 'stillflow:theme'

const COLORS = { light: '#f7f3ea', dark: '#1b1d1a' }

export function resolveTheme(choice: Preferences['theme'], systemDark: boolean): 'light' | 'dark' {
  return choice === 'system' ? (systemDark ? 'dark' : 'light') : choice
}

/** Applies the chosen theme, following the OS live while the choice is "system". */
export function useTheme(choice: Preferences['theme']) {
  useEffect(() => {
    writeJson(THEME_KEY, choice)
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    const apply = () => {
      const t = resolveTheme(choice, !!mq?.matches)
      document.documentElement.setAttribute('data-theme', t)
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLORS[t])
    }
    apply()
    mq?.addEventListener?.('change', apply)
    return () => mq?.removeEventListener?.('change', apply)
  }, [choice])
}
