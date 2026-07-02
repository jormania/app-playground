// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { loadThemePref, saveThemePref, toggleTheme, applyTheme, THEME_KEY } from './theme'

// happy-dom doesn't provide window.localStorage — stub a minimal in-memory
// version, same pattern as rotation.test.js / offlineClient.test.js.
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

describe('loadThemePref', () => {
  it('defaults to light when nothing stored', () => {
    expect(loadThemePref()).toBe('light')
  })

  it('reads a persisted dark preference', () => {
    localStorage.setItem(THEME_KEY, 'dark')
    expect(loadThemePref()).toBe('dark')
  })

  it('falls back to light for any unrecognized stored value', () => {
    localStorage.setItem(THEME_KEY, 'system')
    expect(loadThemePref()).toBe('light')
  })
})

describe('saveThemePref', () => {
  it('persists the theme under THEME_KEY', () => {
    saveThemePref('dark')
    expect(localStorage.getItem(THEME_KEY)).toBe('dark')
  })
})

describe('toggleTheme', () => {
  it('flips light to dark', () => {
    expect(toggleTheme('light')).toBe('dark')
  })

  it('flips dark to light', () => {
    expect(toggleTheme('dark')).toBe('light')
  })
})

describe('applyTheme', () => {
  it('sets data-theme on <html>', () => {
    applyTheme('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('updates the theme-color meta tag to match', () => {
    document.head.innerHTML = '<meta name="theme-color" content="#f4f5f7">'
    applyTheme('dark')
    expect(document.querySelector('meta[name="theme-color"]').getAttribute('content')).toBe('#0e1115')
  })
})
