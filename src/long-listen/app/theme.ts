import { systemPrefersDark } from '../../shared/theme'
import { readJson, removeJson, writeJson } from '../../shared/storage'
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

/**
 * The listening view's shades (palette.css, `data-listening`): four darks, one
 * picked at random on each visit — never the one just shown.
 */
export const DUSK_SHADES = {
  umber: { name: 'Umber', chrome: '#3a2e23' },
  wine: { name: 'Wine dusk', chrome: '#2c1b1b' },
  slate: { name: 'Slate dusk', chrome: '#252a2f' },
  lamp: { name: 'Lamplight', chrome: '#1c1712' },
} as const
export type DuskShade = keyof typeof DUSK_SHADES
export const DUSK_KEYS = Object.keys(DUSK_SHADES) as DuskShade[]

/** Any shade but the last one shown. */
export function pickDusk(last: string | undefined, random: () => number = Math.random): DuskShade {
  const pool = DUSK_KEYS.filter((k) => k !== last)
  return pool[Math.floor(random() * pool.length)] ?? pool[0]
}

const LAST_KEY = 'long-listen:dusk-last'
/** Where a tally of shades shown and liked was kept until 2026-10-10; cleared when next met. */
const OLD_TALLY_KEY = 'long-listen:dusk-tally'

/** The shade for a new visit: chosen once, without side effects (safe to call twice). */
export function chooseDusk(): DuskShade {
  return pickDusk(readJson<string>(LAST_KEY, ''))
}

/** Remember a visit's shade, so the next visit differs. */
export function rememberDusk(shade: DuskShade): void {
  writeJson(LAST_KEY, shade)
  removeJson(OLD_TALLY_KEY)
}

/**
 * Put the listening view in its shade, whatever the theme. Returns the way
 * out: the chosen theme's chrome colour comes back.
 */
export function applyDusk(shade: DuskShade): () => void {
  if (typeof document === 'undefined') return () => {}
  const root = document.documentElement
  const meta = document.querySelector('meta[name="theme-color"]')
  root.dataset.listening = shade
  meta?.setAttribute('content', DUSK_SHADES[shade].chrome)
  return () => {
    delete root.dataset.listening
    const t = root.dataset.theme === 'dark' ? 'dark' : 'light'
    meta?.setAttribute('content', CHROME[t])
  }
}
