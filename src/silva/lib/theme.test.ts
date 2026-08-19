// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { applyTheme, loadThemeChoice, resolveTheme, saveThemeChoice, systemPrefersDark, watchTheme } from './theme'

function fakeMatchMedia(initialMatches: boolean) {
  let listener: ((e: MediaQueryListEvent) => void) | null = null
  const mql = {
    matches: initialMatches,
    addEventListener: vi.fn((_event: string, cb: (e: MediaQueryListEvent) => void) => { listener = cb }),
    removeEventListener: vi.fn(),
  }
  return {
    fakeWindow: { matchMedia: vi.fn(() => mql) } as unknown as Window,
    mql,
    fireChange: (matches: boolean) => listener?.({ matches } as MediaQueryListEvent),
  }
}

describe('resolveTheme', () => {
  it('returns an explicit choice unchanged, whatever the OS says', () => {
    const { fakeWindow } = fakeMatchMedia(true)
    expect(resolveTheme('light', fakeWindow)).toBe('light')
    expect(resolveTheme('dark', fakeWindow)).toBe('dark')
  })

  it('falls back to the OS preference when the choice is null', () => {
    expect(resolveTheme(null, fakeMatchMedia(true).fakeWindow)).toBe('dark')
    expect(resolveTheme(null, fakeMatchMedia(false).fakeWindow)).toBe('light')
  })
})

describe('systemPrefersDark', () => {
  it('is false rather than throwing where matchMedia is unavailable', () => {
    expect(systemPrefersDark({} as Window)).toBe(false)
    expect(systemPrefersDark(undefined)).toBe(false)
  })
})

describe('loadThemeChoice / saveThemeChoice', () => {
  beforeEach(() => localStorage.clear())

  it('defaults to null — follow the OS', () => {
    expect(loadThemeChoice()).toBeNull()
  })

  it('round-trips both explicit choices', () => {
    saveThemeChoice('dark')
    expect(loadThemeChoice()).toBe('dark')
    saveThemeChoice('light')
    expect(loadThemeChoice()).toBe('light')
    saveThemeChoice(null)
    expect(loadThemeChoice()).toBeNull()
  })

  it('treats an unrecognised stored value as "follow the OS" rather than guessing', () => {
    localStorage.setItem('silva:theme', JSON.stringify('twilight'))
    expect(loadThemeChoice()).toBeNull()
  })
})

describe('applyTheme', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme')
  })

  it('sets data-theme to the resolved palette', () => {
    applyTheme('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    applyTheme('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('does not throw with no document', () => {
    expect(() => applyTheme('dark', undefined)).not.toThrow()
  })
})

describe('watchTheme', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme')
  })

  it('applies the OS preference and keeps following it while the choice is null', () => {
    const { fakeWindow, fireChange } = fakeMatchMedia(false)
    watchTheme(null, document, fakeWindow)
    expect(document.documentElement.dataset.theme).toBe('light')
    fireChange(true)
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('stops following the OS once a palette is chosen explicitly', () => {
    const { fakeWindow, mql, fireChange } = fakeMatchMedia(false)
    watchTheme('dark', document, fakeWindow)
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(mql.addEventListener).not.toHaveBeenCalled()
    fireChange(false)
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('returns a cleanup that detaches the OS listener', () => {
    const { fakeWindow, mql } = fakeMatchMedia(false)
    watchTheme(null, document, fakeWindow)()
    expect(mql.removeEventListener).toHaveBeenCalled()
  })

  it('returns a no-op cleanup where matchMedia throws', () => {
    const hostileWindow = { matchMedia: () => { throw new Error('no') } } as unknown as Window
    expect(() => watchTheme(null, document, hostileWindow)()).not.toThrow()
  })
})
