// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { syncSystemTheme } from './theme'

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

describe('syncSystemTheme', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme')
  })

  it('sets data-theme to dark when the system prefers dark', () => {
    const { fakeWindow } = fakeMatchMedia(true)
    syncSystemTheme(document, fakeWindow)
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('sets data-theme to light when the system prefers light', () => {
    const { fakeWindow } = fakeMatchMedia(false)
    syncSystemTheme(document, fakeWindow)
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('updates data-theme when the system preference changes', () => {
    const { fakeWindow, fireChange } = fakeMatchMedia(false)
    syncSystemTheme(document, fakeWindow)
    expect(document.documentElement.dataset.theme).toBe('light')
    fireChange(true)
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('returns a cleanup function that removes the listener', () => {
    const { fakeWindow, mql } = fakeMatchMedia(false)
    const cleanup = syncSystemTheme(document, fakeWindow)
    cleanup()
    expect(mql.removeEventListener).toHaveBeenCalled()
  })
})
