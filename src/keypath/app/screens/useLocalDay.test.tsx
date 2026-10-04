// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useLocalDay } from './TodayCard'

afterEach(() => {
  vi.useRealTimers()
})

describe('useLocalDay', () => {
  it('moves on at midnight while the app stays open', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 4, 23, 59, 0))
    const { result } = renderHook(() => useLocalDay())
    expect(result.current).toBe('2026-10-04')
    act(() => {
      vi.advanceTimersByTime(2 * 60 * 1000)
    })
    expect(result.current).toBe('2026-10-05')
  })

  it('catches up when the phone wakes after midnight', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 9, 4, 22, 0, 0))
    const { result } = renderHook(() => useLocalDay())
    vi.setSystemTime(new Date(2026, 9, 5, 7, 0, 0))
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current).toBe('2026-10-05')
  })
})
