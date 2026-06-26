import { describe, it, expect } from 'vitest'
import { loadThemePref, saveThemePref, nextTheme, resolveTheme, THEME_KEY } from './theme'

function memStore(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
  }
}

describe('theme', () => {
  it('defaults to light, reads stored dark / system', () => {
    expect(loadThemePref(memStore())).toBe('light')
    expect(loadThemePref(memStore({ [THEME_KEY]: 'dark' }))).toBe('dark')
    expect(loadThemePref(memStore({ [THEME_KEY]: 'system' }))).toBe('system')
    expect(loadThemePref(memStore({ [THEME_KEY]: 'nonsense' }))).toBe('light')
  })

  it('round-trips via save', () => {
    const store = memStore()
    saveThemePref('dark', store)
    expect(loadThemePref(store)).toBe('dark')
    saveThemePref('system', store)
    expect(loadThemePref(store)).toBe('system')
  })

  it('nextTheme flips a resolved palette', () => {
    expect(nextTheme('light')).toBe('dark')
    expect(nextTheme('dark')).toBe('light')
  })

  it('resolveTheme passes light/dark through', () => {
    expect(resolveTheme('light')).toBe('light')
    expect(resolveTheme('dark')).toBe('dark')
    // 'system' resolves via matchMedia (false in node) → light
    expect(resolveTheme('system')).toBe('light')
  })
})
