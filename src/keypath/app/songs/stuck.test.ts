// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STUCK_MS, useStuck } from './stuck'

describe('useStuck', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('is stuck after a pause on the same step, or at once after a wrong key, and starts again on the next step', () => {
    const { result, rerender } = renderHook(({ step, active }) => useStuck(step, active), { initialProps: { step: 'a', active: true } })
    expect(result.current.stuck).toBe(false)
    act(() => void vi.advanceTimersByTime(STUCK_MS - 1))
    expect(result.current.stuck).toBe(false)
    act(() => void vi.advanceTimersByTime(1))
    expect(result.current.stuck).toBe(true)
    rerender({ step: 'b', active: true })
    expect(result.current.stuck).toBe(false)
    act(() => result.current.wrongKey())
    expect(result.current.stuck).toBe(true)
  })

  it('is never stuck while off', () => {
    const { result } = renderHook(() => useStuck('a', false))
    act(() => void vi.advanceTimersByTime(STUCK_MS * 2))
    act(() => result.current.wrongKey())
    expect(result.current.stuck).toBe(false)
  })
})
