// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import { systemPrefersDark, useThemeSync } from './theme'

afterEach(cleanup)

describe('systemPrefersDark', () => {
  it('reports what the media query says', () => {
    const win = { matchMedia: () => ({ matches: true }) } as unknown as Window
    expect(systemPrefersDark(win)).toBe(true)
  })

  it('reads as light rather than throwing when there is no window', () => {
    expect(systemPrefersDark(undefined)).toBe(false)
  })

  it('reads as light when the query itself throws', () => {
    const win = { matchMedia: () => { throw new Error('nope') } } as unknown as Window
    expect(systemPrefersDark(win)).toBe(false)
  })
})

describe('useThemeSync', () => {
  const KEY = 'test:theme'
  let stored: string

  beforeEach(() => {
    stored = 'light'
  })

  const handlers = () => ({
    load: vi.fn(() => stored),
    save: vi.fn((v: string) => { stored = v }),
    apply: vi.fn(),
  })

  it('starts from the stored preference and applies it once', () => {
    stored = 'dark'
    const h = handlers()
    const { result } = renderHook(() => useThemeSync(KEY, h))

    expect(result.current[0]).toBe('dark')
    expect(h.apply).toHaveBeenCalledWith('dark')
    expect(h.save).toHaveBeenCalledWith('dark')
  })

  it('applies before it saves, so a failed write still shows the right theme', () => {
    const h = handlers()
    renderHook(() => useThemeSync(KEY, h))
    expect(h.apply.mock.invocationCallOrder[0]).toBeLessThan(h.save.mock.invocationCallOrder[0])
  })

  it('applies and persists every change', () => {
    const h = handlers()
    const { result } = renderHook(() => useThemeSync(KEY, h))

    act(() => result.current[1]('dark'))

    expect(result.current[0]).toBe('dark')
    expect(h.apply).toHaveBeenLastCalledWith('dark')
    expect(stored).toBe('dark')
  })

  it('takes an updater function, which is how callers build toggle and cycle', () => {
    const h = handlers()
    const { result } = renderHook(() => useThemeSync<string>(KEY, h))

    act(() => result.current[1]((t) => (t === 'light' ? 'dark' : 'light')))

    expect(result.current[0]).toBe('dark')
  })

  // The cross-tab path. Nothing in the repo covered this before the mechanism
  // was shared, which is the main reason it is covered now: six providers each
  // had their own copy of this listener and none of them had a test.
  it('follows another tab writing the same key', () => {
    const h = handlers()
    const { result } = renderHook(() => useThemeSync(KEY, h))

    stored = 'dark'
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: KEY }))
    })

    expect(result.current[0]).toBe('dark')
  })

  it('ignores a write to some other key', () => {
    const h = handlers()
    const { result } = renderHook(() => useThemeSync(KEY, h))

    stored = 'dark'
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'something:else' }))
    })

    expect(result.current[0]).toBe('light')
  })

  it('stops listening once unmounted', () => {
    const h = handlers()
    const remove = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useThemeSync(KEY, h))

    unmount()

    expect(remove).toHaveBeenCalledWith('storage', expect.any(Function))
    remove.mockRestore()
  })
})
