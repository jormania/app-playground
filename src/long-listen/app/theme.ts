import { systemPrefersDark } from '../../shared/theme'
import type { ThemeChoice } from './settings'

/**
 * Light, dark or follow the device. The palette itself swaps in CSS
 * (styles/palette.css, keyed off `data-theme`); this only decides which, and
 * tints the browser chrome to match. Keep the two colours here in step with
 * the inline script in long-listen-react.html, which paints before React loads.
 */
export const CHROME = { light: '#f5efe3', dark: '#16130f' } as const

export function resolveTheme(choice: ThemeChoice): 'light' | 'dark' {
  if (choice === 'light' || choice === 'dark') return choice
  return systemPrefersDark() ? 'dark' : 'light'
}

export function applyTheme(choice: ThemeChoice): void {
  if (typeof document === 'undefined') return
  const t = resolveTheme(choice)
  document.documentElement.dataset.theme = t
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', CHROME[t])
}
