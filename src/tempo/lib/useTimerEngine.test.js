// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTimerEngine } from './useTimerEngine'

const segments = [
  { id: 'a', label: 'Work', seconds: 10, kind: 'work' },
  { id: 'b', label: 'Rest', seconds: 5, kind: 'rest' },
]

// Controls performance.now() independently of vitest's fake setInterval/clearInterval,
// so tick-driven advancement and elapsed-time math can be tested deterministically.
function fakeClock(initial) {
  let current = initial
  vi.spyOn(performance, 'now').mockImplementation(() => current)
  return { advance: (ms) => { current += ms } }
}

describe('useTimerEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('starts idle, previewing the first segment duration', () => {
    const { result } = renderHook(() => useTimerEngine(segments))
    expect(result.current.status).toBe('idle')
    expect(result.current.secondsRemaining).toBe(10)
  })

  it('counts down while running as ticks arrive', () => {
    const clock = fakeClock(1000)
    const { result } = renderHook(() => useTimerEngine(segments))
    act(() => result.current.start())
    expect(result.current.status).toBe('running')

    act(() => {
      clock.advance(3000)
      vi.advanceTimersByTime(250)
    })
    expect(result.current.secondsRemaining).toBe(7)
  })

  it('freezes elapsed time while paused, then resumes correctly', () => {
    const clock = fakeClock(1000)
    const { result } = renderHook(() => useTimerEngine(segments))
    act(() => result.current.start())
    act(() => {
      clock.advance(3000)
      vi.advanceTimersByTime(250)
    })
    expect(result.current.secondsRemaining).toBe(7)

    act(() => result.current.pause())
    clock.advance(5000) // real time passes while paused; no tick should apply it
    expect(result.current.secondsRemaining).toBe(7)

    act(() => result.current.resume())
    expect(result.current.secondsRemaining).toBe(7)

    act(() => {
      clock.advance(2000)
      vi.advanceTimersByTime(250)
    })
    expect(result.current.secondsRemaining).toBe(5)
  })

  it('advances to the next segment when exhausted, carrying overshoot forward', () => {
    const clock = fakeClock(1000)
    const { result } = renderHook(() => useTimerEngine(segments))
    act(() => result.current.start())
    // Work is 10s; jump 12s in one tick (2s overshoot) while backgrounded.
    act(() => {
      clock.advance(12000)
      vi.advanceTimersByTime(250)
    })
    expect(result.current.currentIndex).toBe(1)
    expect(result.current.currentSegment.label).toBe('Rest')
    expect(result.current.secondsRemaining).toBe(3) // 5s rest minus 2s overshoot
  })

  it('skip jumps straight to the next segment', () => {
    const { result } = renderHook(() => useTimerEngine(segments))
    act(() => result.current.start())
    act(() => result.current.skip())
    expect(result.current.currentIndex).toBe(1)
    expect(result.current.currentSegment.label).toBe('Rest')
  })

  it('reaches done once every segment has elapsed', () => {
    const clock = fakeClock(1000)
    const { result } = renderHook(() => useTimerEngine(segments))
    act(() => result.current.start())
    act(() => {
      clock.advance(20000) // well past both segments combined (15s)
      vi.advanceTimersByTime(250)
    })
    expect(result.current.status).toBe('done')
    expect(result.current.secondsRemaining).toBe(0)
  })

  it('goes straight to done when started with no segments', () => {
    const { result } = renderHook(() => useTimerEngine([]))
    act(() => result.current.start())
    expect(result.current.status).toBe('done')
  })

  it('reset returns to idle at the first segment', () => {
    const { result } = renderHook(() => useTimerEngine(segments))
    act(() => result.current.start())
    act(() => result.current.skip())
    act(() => result.current.reset())
    expect(result.current.status).toBe('idle')
    expect(result.current.currentIndex).toBe(0)
  })
})
