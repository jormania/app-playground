// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import { systemPrefersDark, useThemeSync, useSystemThemeFollow } from './theme'

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

describe('useSystemThemeFollow', () => {
  // The OS-follow effect was copied into three providers and tested in none of
  // them, which is the other half of why it was promoted (R-026).
  const makeMq = ({ legacy = false } = {}) => {
    const listeners: Array<() => void> = []
    const mq: Record<string, unknown> = {
      matches: false,
      removed: 0,
      fire: () => listeners.slice().forEach((l) => l()),
      count: () => listeners.length,
    }
    if (legacy) {
      // Safari < 14: a MediaQueryList with only addListener/removeListener.
      mq.addListener = (l: () => void) => { listeners.push(l) }
      mq.removeListener = (l: () => void) => {
        const i = listeners.indexOf(l)
        if (i >= 0) listeners.splice(i, 1)
        ;(mq.removed as number)++
      }
    } else {
      mq.addEventListener = (_e: string, l: () => void) => { listeners.push(l) }
      mq.removeEventListener = (_e: string, l: () => void) => {
        const i = listeners.indexOf(l)
        if (i >= 0) listeners.splice(i, 1)
        ;(mq.removed as number)++
      }
    }
    return mq
  }

  const install = (mq: unknown) => {
    vi.stubGlobal('matchMedia', vi.fn(() => mq))
    // window.matchMedia is what the hook calls; in jsdom window IS globalThis,
    // but assign it explicitly so the stub holds either way.
    ;(window as unknown as Record<string, unknown>).matchMedia = globalThis.matchMedia
  }

  afterEach(() => { vi.unstubAllGlobals() })

  it('subscribes while active and calls back when the OS flips', () => {
    const mq = makeMq()
    install(mq)
    const onChange = vi.fn()

    renderHook(() => useSystemThemeFollow(true, onChange))
    expect((mq.count as () => number)()).toBe(1)

    ;(mq.fire as () => void)()
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('does not subscribe at all while inactive', () => {
    const mq = makeMq()
    install(mq)

    renderHook(() => useSystemThemeFollow(false, vi.fn()))
    expect((mq.count as () => number)()).toBe(0)
  })

  it('unsubscribes on unmount', () => {
    const mq = makeMq()
    install(mq)

    const { unmount } = renderHook(() => useSystemThemeFollow(true, vi.fn()))
    unmount()

    expect((mq.count as () => number)()).toBe(0)
    expect(mq.removed).toBe(1)
  })

  it('unsubscribes when it stops being active', () => {
    // Switching the preference away from "system" must stop the listener, or a
    // sunset flip repaints an app the user has explicitly pinned to light.
    const mq = makeMq()
    install(mq)
    const onChange = vi.fn()

    const { rerender } = renderHook(({ on }) => useSystemThemeFollow(on, onChange), {
      initialProps: { on: true },
    })
    rerender({ on: false })

    ;(mq.fire as () => void)()
    expect(onChange).not.toHaveBeenCalled()
    expect((mq.count as () => number)()).toBe(0)
  })

  it('falls back to addListener on a Safari < 14 MediaQueryList', () => {
    // The guard Tempo's and Daily Stoic's copies lack, and the reason Law of
    // the Day's was the version promoted.
    const mq = makeMq({ legacy: true })
    install(mq)
    const onChange = vi.fn()

    const { unmount } = renderHook(() => useSystemThemeFollow(true, onChange))
    ;(mq.fire as () => void)()
    expect(onChange).toHaveBeenCalledTimes(1)

    unmount()
    expect((mq.count as () => number)()).toBe(0)
  })

  it('mounts anyway when matchMedia throws or is missing', () => {
    vi.stubGlobal('matchMedia', () => { throw new Error('nope') })
    ;(window as unknown as Record<string, unknown>).matchMedia = globalThis.matchMedia

    expect(() => renderHook(() => useSystemThemeFollow(true, vi.fn()))).not.toThrow()
  })

  it('does not tear the listener down when only the callback changes', () => {
    // Every caller passes an inline arrow, so a naive dependency on onChange
    // would resubscribe on every render. The newest callback still wins.
    const mq = makeMq()
    install(mq)
    const first = vi.fn()
    const second = vi.fn()

    const { rerender } = renderHook(({ cb }) => useSystemThemeFollow(true, cb), {
      initialProps: { cb: first },
    })
    rerender({ cb: second })

    expect(mq.removed).toBe(0)
    expect((mq.count as () => number)()).toBe(1)

    ;(mq.fire as () => void)()
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })
})
