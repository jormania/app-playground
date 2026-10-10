import { systemPrefersDark } from '../../shared/theme'
import { readJson, writeJson } from '../../shared/storage'
import type { DuskChoice, ThemeChoice } from './settings'

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
 * The listening view's shades (palette.css, `data-listening`): four darks the
 * owner is choosing between by living with them. "Rotate" picks one at random
 * on each visit — never the one just shown — and keeps a quiet tally of how
 * often each was shown and liked, read back in Settings.
 */
export const DUSK_SHADES = {
  umber: { name: 'Umber', chrome: '#3a2e23' },
  wine: { name: 'Wine dusk', chrome: '#2c1b1b' },
  slate: { name: 'Slate dusk', chrome: '#252a2f' },
  lamp: { name: 'Lamplight', chrome: '#1c1712' },
} as const
export type DuskShade = keyof typeof DUSK_SHADES
export const DUSK_KEYS = Object.keys(DUSK_SHADES) as DuskShade[]

const TALLY_KEY = 'long-listen:dusk-tally'
export type DuskTally = Record<DuskShade, { shown: number; liked: number }>

export function duskTally(): DuskTally {
  const raw = readJson<Partial<DuskTally>>(TALLY_KEY, {})
  return Object.fromEntries(DUSK_KEYS.map((k) => [k, { shown: raw[k]?.shown ?? 0, liked: raw[k]?.liked ?? 0 }])) as DuskTally
}

function count(shade: DuskShade, field: 'shown' | 'liked'): void {
  const t = duskTally()
  t[shade][field] += 1
  writeJson(TALLY_KEY, t)
}

export const likeDusk = (shade: DuskShade) => count(shade, 'liked')

/** Which shade this visit gets: the chosen one, or — rotating — any other than last time's. */
export function pickDusk(choice: DuskChoice, last: string | undefined, random: () => number = Math.random): DuskShade {
  if (choice !== 'rotate') return choice
  const pool = DUSK_KEYS.filter((k) => k !== last)
  return pool[Math.floor(random() * pool.length)] ?? pool[0]
}

const LAST_KEY = 'long-listen:dusk-last'

/** The shade for a new visit: chosen once, without side effects (safe to call twice). */
export function chooseDusk(choice: DuskChoice): DuskShade {
  return pickDusk(choice, readJson<string>(LAST_KEY, ''))
}

/**
 * Count a visit's shade once, and remember it so the next visit differs. Only
 * while rotating: the tally is how the owner compares shades met by chance, and
 * a shade kept on purpose would count every visit towards itself.
 */
export function recordDusk(shade: DuskShade, choice: DuskChoice): void {
  if (choice !== 'rotate') return
  writeJson(LAST_KEY, shade)
  count(shade, 'shown')
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
