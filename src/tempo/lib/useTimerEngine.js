import { useCallback, useEffect, useReducer } from 'react'

const initialState = {
  status: 'idle', // 'idle' | 'running' | 'paused' | 'done'
  currentIndex: 0,
  segmentStartedAt: null,
  accumulatedPauseMs: 0,
  pausedAt: null,
}

// Never trusts a stored "seconds remaining" counter — everything is derived
// from timestamps on every read, so a late tick or a throttled background tab
// self-corrects instead of drifting.
function elapsedMs(state, now) {
  if (state.segmentStartedAt == null) return 0
  const pausedNow = state.pausedAt != null ? now - state.pausedAt : 0
  return now - state.segmentStartedAt - state.accumulatedPauseMs - pausedNow
}

function secondsRemainingFor(segment, state, now) {
  if (!segment) return 0
  const remainingMs = segment.seconds * 1000 - elapsedMs(state, now)
  return Math.max(0, Math.ceil(remainingMs / 1000))
}

// Walks forward while the current segment's time is exhausted, carrying any
// overshoot into the next segment's start time rather than losing it — this
// is what makes a late tick or a backgrounded tab land on the correct segment
// instead of drifting.
function advance(state, segments, now) {
  let { currentIndex, segmentStartedAt, accumulatedPauseMs } = state
  for (;;) {
    const seg = segments[currentIndex]
    if (!seg) return { ...state, status: 'done', currentIndex }

    const remainingMs = seg.seconds * 1000 - (now - segmentStartedAt - accumulatedPauseMs)
    if (remainingMs > 0) {
      return { ...state, currentIndex, segmentStartedAt, accumulatedPauseMs, status: 'running' }
    }

    const nextIndex = currentIndex + 1
    if (nextIndex >= segments.length) {
      return { ...state, status: 'done', currentIndex }
    }
    currentIndex = nextIndex
    segmentStartedAt = now + remainingMs // remainingMs <= 0, so this carries the overshoot forward
    accumulatedPauseMs = 0
  }
}

function reducer(state, action, segments) {
  switch (action.type) {
    case 'START':
      return advance(
        { status: 'running', currentIndex: 0, segmentStartedAt: action.now, accumulatedPauseMs: 0, pausedAt: null },
        segments,
        action.now,
      )

    case 'PAUSE':
      if (state.status !== 'running') return state
      return { ...state, status: 'paused', pausedAt: action.now }

    case 'RESUME': {
      if (state.status !== 'paused') return state
      const extraPause = action.now - state.pausedAt
      return advance(
        { ...state, status: 'running', pausedAt: null, accumulatedPauseMs: state.accumulatedPauseMs + extraPause },
        segments,
        action.now,
      )
    }

    case 'TICK':
      if (state.status !== 'running') return state
      return advance(state, segments, action.now)

    case 'SKIP': {
      if (state.status !== 'running' && state.status !== 'paused') return state
      const nextIndex = state.currentIndex + 1
      if (nextIndex >= segments.length) return { ...state, status: 'done' }
      return {
        status: 'running',
        currentIndex: nextIndex,
        segmentStartedAt: action.now,
        accumulatedPauseMs: 0,
        pausedAt: null,
      }
    }

    case 'RESET':
      return initialState

    default:
      return state
  }
}

export function useTimerEngine(segments) {
  const [state, dispatch] = useReducer((s, a) => reducer(s, a, segments), initialState)

  useEffect(() => {
    if (state.status !== 'running') return undefined

    const tick = () => dispatch({ type: 'TICK', now: performance.now() })
    const id = setInterval(tick, 250)

    const onVisibility = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [state.status])

  const start = useCallback(() => dispatch({ type: 'START', now: performance.now() }), [])
  const pause = useCallback(() => dispatch({ type: 'PAUSE', now: performance.now() }), [])
  const resume = useCallback(() => dispatch({ type: 'RESUME', now: performance.now() }), [])
  const skip = useCallback(() => dispatch({ type: 'SKIP', now: performance.now() }), [])
  const reset = useCallback(() => dispatch({ type: 'RESET' }), [])

  const currentSegment = segments[state.currentIndex] ?? null
  const now = performance.now()
  let secondsRemaining
  if (state.status === 'running' || state.status === 'paused') {
    secondsRemaining = secondsRemainingFor(currentSegment, state, now)
  } else if (state.status === 'done') {
    secondsRemaining = 0
  } else {
    secondsRemaining = currentSegment ? currentSegment.seconds : 0
  }

  return {
    status: state.status,
    currentIndex: state.currentIndex,
    currentSegment,
    secondsRemaining,
    totalSegments: segments.length,
    start,
    pause,
    resume,
    skip,
    reset,
  }
}
