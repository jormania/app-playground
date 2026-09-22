// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadThemePref,
  saveThemePref,
  nextThemePref,
  resolveTheme,
  themePrefLabel,
  applyTheme,
  THEME_KEY,
} from './theme'

// happy-dom doesn't provide window.localStorage — stub a minimal in-memory
// version, same pattern as rotation.test.js / offlineClient.test.js.
const store = new Map()
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
}

// A stand-in for the OS preference, so `system` can be tested both ways.
function fakeWin(prefersDark) {
  return { matchMedia: () => ({ matches: prefersDark }) }
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
})

describe('loadThemePref', () => {
  it('defaults to following the system when nothing is stored', () => {
    expect(loadThemePref()).toBe('system')
  })

  it('reads a persisted explicit override', () => {
    localStorage.setItem(THEME_KEY, 'dark')
    expect(loadThemePref()).toBe('dark')
    localStorage.setItem(THEME_KEY, 'light')
    expect(loadThemePref()).toBe('light')
  })

  it('falls back to system for any unrecognized stored value', () => {
    localStorage.setItem(THEME_KEY, 'sepia')
    expect(loadThemePref()).toBe('system')
  })
})

describe('saveThemePref', () => {
  it('persists the preference under THEME_KEY', () => {
    saveThemePref('dark')
    expect(localStorage.getItem(THEME_KEY)).toBe('dark')
  })
})

describe('resolveTheme', () => {
  it('passes an explicit preference straight through, whatever the OS says', () => {
    expect(resolveTheme('light', fakeWin(true))).toBe('light')
    expect(resolveTheme('dark', fakeWin(false))).toBe('dark')
  })

  it('follows the OS under system', () => {
    expect(resolveTheme('system', fakeWin(true))).toBe('dark')
    expect(resolveTheme('system', fakeWin(false))).toBe('light')
  })
})

describe('nextThemePref', () => {
  it('cycles system → light → dark → system', () => {
    expect(nextThemePref('system')).toBe('light')
    expect(nextThemePref('light')).toBe('dark')
    expect(nextThemePref('dark')).toBe('system')
  })
})

describe('themePrefLabel', () => {
  it('names each preference', () => {
    expect(themePrefLabel('system')).toBe('System')
    expect(themePrefLabel('light')).toBe('Light')
    expect(themePrefLabel('dark')).toBe('Dark')
  })
})

describe('applyTheme', () => {
  it('puts the resolved theme on <html>, not the preference', () => {
    window.matchMedia = () => ({ matches: true })
    applyTheme('system')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

    applyTheme('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('updates the theme-color meta tag to match the resolved theme', () => {
    document.head.innerHTML = '<meta name="theme-color" content="#fdf8ec">'
    applyTheme('dark')
    expect(document.querySelector('meta[name="theme-color"]').getAttribute('content')).toBe('#12141c')
    applyTheme('light')
    expect(document.querySelector('meta[name="theme-color"]').getAttribute('content')).toBe('#fdf8ec')
  })
})
