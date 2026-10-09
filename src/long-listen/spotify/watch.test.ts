import { describe, it, expect, vi, afterEach } from 'vitest'
import { PlayerWatch, nextLookIn, IDLE_MS } from './watch'
import { SpotifyUnavailable, type NowPlaying } from './client'

const np = (over: Partial<NowPlaying> = {}): NowPlaying => ({ trackId: 'm1', trackName: 'I', isPlaying: true, progressMs: 0, durationMs: 0, ...over })

function fakeDoc(state: 'visible' | 'hidden' = 'visible') {
  const handlers = new Set<() => void>()
  return {
    visibilityState: state as DocumentVisibilityState,
    addEventListener: (_: string, h: () => void) => { handlers.add(h) },
    removeEventListener: (_: string, h: () => void) => { handlers.delete(h) },
    fire() { for (const h of handlers) h() },
    handlers,
  }
}

afterEach(() => { vi.useRealTimers() })

describe('nextLookIn', () => {
  it('looks again just after the movement should end, within bounds', () => {
    expect(nextLookIn(np({ durationMs: 600_000, progressMs: 595_000 }))).toBe(6_500)
    expect(nextLookIn(np({ durationMs: 600_000, progressMs: 599_900 }))).toBe(3_000)
    expect(nextLookIn(np({ durationMs: 600_000, progressMs: 0 }))).toBe(IDLE_MS)
    expect(nextLookIn(np({ isPlaying: false, durationMs: 600_000 }))).toBe(IDLE_MS)
    expect(nextLookIn(null)).toBe(IDLE_MS)
  })
})

describe('PlayerWatch', () => {
  it('asks Spotify once for any number of watchers, and stops when the last leaves', async () => {
    vi.useFakeTimers()
    const nowPlaying = vi.fn(async () => np())
    const w = new PlayerWatch({ connected: true, nowPlaying }, fakeDoc())
    const a = vi.fn(); const b = vi.fn()
    const offA = w.subscribe(a); const offB = w.subscribe(b)
    await vi.advanceTimersByTimeAsync(0)
    expect(nowPlaying).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenLastCalledWith(expect.objectContaining({ np: expect.objectContaining({ trackId: 'm1' }), known: true }))
    await vi.advanceTimersByTimeAsync(IDLE_MS)
    expect(nowPlaying).toHaveBeenCalledTimes(2)
    offA(); offB()
    await vi.advanceTimersByTimeAsync(IDLE_MS * 3)
    expect(nowPlaying).toHaveBeenCalledTimes(2)
  })

  it('stays quiet while the page is hidden and looks the moment it returns', async () => {
    vi.useFakeTimers()
    const nowPlaying = vi.fn(async () => null)
    const doc = fakeDoc('hidden')
    const w = new PlayerWatch({ connected: true, nowPlaying }, doc)
    w.subscribe(() => {})
    await vi.advanceTimersByTimeAsync(IDLE_MS * 2)
    expect(nowPlaying).not.toHaveBeenCalled()
    doc.visibilityState = 'visible'
    doc.fire()
    await vi.advanceTimersByTimeAsync(0)
    expect(nowPlaying).toHaveBeenCalledTimes(1)
  })

  it('shows a command’s outcome at once and checks again shortly after', async () => {
    vi.useFakeTimers()
    const nowPlaying = vi.fn(async () => np())
    const w = new PlayerWatch({ connected: true, nowPlaying }, fakeDoc())
    const seen = vi.fn()
    w.subscribe(seen)
    await vi.advanceTimersByTimeAsync(0)
    w.expect((x) => x && { ...x, isPlaying: false })
    expect(seen).toHaveBeenLastCalledWith(expect.objectContaining({ np: expect.objectContaining({ isPlaying: false }) }))
    await vi.advanceTimersByTimeAsync(1_300)
    expect(nowPlaying).toHaveBeenCalledTimes(2)
  })

  it('says when this sign-in can’t read playback', async () => {
    vi.useFakeTimers()
    const nowPlaying = vi.fn(async () => { throw new SpotifyUnavailable('signed-out', 'x') })
    const w = new PlayerWatch({ connected: true, nowPlaying }, fakeDoc())
    const seen = vi.fn()
    w.subscribe(seen)
    await vi.advanceTimersByTimeAsync(0)
    expect(seen).toHaveBeenLastCalledWith(expect.objectContaining({ cantFollow: true }))
  })
})
