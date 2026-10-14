// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { keepPlace, placeFrom, savedPlace } from './playback'
import type { NowPlaying } from '../spotify/client'

const ids = ['t1', 't2', 't3']
const np = (trackId: string, progressMs: number, isPlaying = true): NowPlaying => ({ trackId, trackName: '', isPlaying, progressMs, durationMs: 600_000 })

describe('where a listening was left', () => {
  beforeEach(() => localStorage.clear())

  it('is kept from a reading of the work, and let go when it comes to rest at its end', () => {
    expect(placeFrom(np('t2', 252_000), ids, 1000)).toEqual({ index: 1, progressMs: 252_000, at: 1000 })
    expect(placeFrom(np('t2', 252_000, false), ids, 1000)).toEqual({ index: 1, progressMs: 252_000, at: 1000 })
    // Something else on: says nothing about this work.
    expect(placeFrom(np('other', 5), ids, 1000)).toBeUndefined()
    // The last movement at rest at its close: the work is over.
    expect(placeFrom(np('t3', 599_000, false), ids, 1000)).toBeNull()
  })

  it('outlives Spotify forgetting it, for a month, and never offers the very start', () => {
    const now = Date.now()
    keepPlace(ids, { index: 1, progressMs: 252_000, at: now - 3 * 3600_000 })
    expect(savedPlace(ids, now)).toMatchObject({ index: 1, progressMs: 252_000 })
    expect(savedPlace(ids, now + 31 * 86_400_000)).toBeNull()
    keepPlace(ids, { index: 0, progressMs: 2000, at: now })
    expect(savedPlace(ids, now)).toBeNull()
    keepPlace(ids, null)
    expect(savedPlace(ids, now)).toBeNull()
    // Another album's division of the work (fewer tracks): a place past its end is no place.
    keepPlace(ids, { index: 2, progressMs: 1000, at: now })
    expect(savedPlace(['t1', 't2'], now)).toBeNull()
  })
})
