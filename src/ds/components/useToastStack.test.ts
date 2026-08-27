// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useToastStack } from './useToastStack'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('useToastStack', () => {
  it('pushes a toast and returns its id', () => {
    const { result } = renderHook(() => useToastStack())
    let id = ''
    act(() => { id = result.current.push({ message: 'Kept it' }) })
    expect(result.current.toasts).toEqual([expect.objectContaining({ id, message: 'Kept it' })])
  })

  it('auto-dismisses after its own duration, not the default, when given one', () => {
    const { result } = renderHook(() => useToastStack())
    act(() => { result.current.push({ message: 'Short-lived', duration: 1000 }) })
    act(() => { vi.advanceTimersByTime(999) })
    expect(result.current.toasts).toHaveLength(1)
    act(() => { vi.advanceTimersByTime(1) })
    expect(result.current.toasts).toHaveLength(0)
  })

  it('dismiss() removes it immediately and cancels the pending timer', () => {
    const { result } = renderHook(() => useToastStack())
    let id = ''
    act(() => { id = result.current.push({ message: 'Bye' }) })
    act(() => { result.current.dismiss(id) })
    expect(result.current.toasts).toHaveLength(0)
    // Advancing time must not somehow resurrect or double-remove it.
    act(() => { vi.advanceTimersByTime(10000) })
    expect(result.current.toasts).toHaveLength(0)
  })

  it('keeps several toasts independent — dismissing one leaves the others', () => {
    const { result } = renderHook(() => useToastStack())
    let first = ''
    act(() => {
      first = result.current.push({ message: 'One' })
      result.current.push({ message: 'Two' })
    })
    act(() => { result.current.dismiss(first) })
    expect(result.current.toasts.map((t) => t.message)).toEqual(['Two'])
  })
})
