// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { forgetPlaceBefore, keepPlace, placeFrom, savedPlace } from './place'
import type { NowPlaying } from '../spotify/client'

const ids = ['t1', 't2', 't3']
const np = (trackId: string, progressMs: number, isPlaying = true): NowPlaying => ({ trackId, trackName: '', isPlaying, progressMs, durationMs: 600_000 })

describe('where a listening was left', () => {
  beforeEach(() => localStorage.clear())

  it('is kept from a reading of the work, and let go when it comes to rest at its end', () => {
    expect(placeFrom(null, np('t2', 252_000), ids, 1000)).toEqual({ index: 1, progressMs: 252_000, at: 1000 })
    expect(placeFrom(null, np('t2', 252_000, false), ids, 1000)).toEqual({ index: 1, progressMs: 252_000, at: 1000 })
    // Something else on: says nothing about this work.
    expect(placeFrom(null, np('other', 5), ids, 1000)).toBeUndefined()
    // The last movement at rest at its close: the work is over.
    expect(placeFrom(null, np('t3', 599_000, false), ids, 1000)).toBeNull()
  })

  it('is let go when the work ends however Spotify ends it, and kept through a pause at the finale’s first seconds', () => {
    const nearEnd = np('t3', 590_000)
    // Rewound to the first movement, at rest.
    expect(placeFrom(nearEnd, np('t1', 0, false), ids, 1000)).toBeNull()
    // Run on into the next track on the album.
    expect(placeFrom(nearEnd, np('next-work', 3000), ids, 1000)).toBeNull()
    // Nothing playing at all.
    expect(placeFrom(nearEnd, null, ids, 1000)).toBeNull()
    // At rest at the very start: no place.
    expect(placeFrom(null, np('t1', 500, false), ids, 1000)).toBeNull()
    // The finale paused a second in: the place before it stands.
    expect(placeFrom(null, np('t3', 1000, false), ids, 1000)).toBeUndefined()
  })

  it('is let go once heard through after it was kept, and not for a hearing that ended before it', () => {
    const now = Date.now()
    keepPlace(ids, { index: 1, progressMs: 252_000, at: now - 1000 })
    forgetPlaceBefore(ids, now - 5000)
    expect(savedPlace(ids, now)).not.toBeNull()
    forgetPlaceBefore(ids, now)
    expect(savedPlace(ids, now)).toBeNull()
  })

  it('belongs to one album’s division of the work', () => {
    const now = Date.now()
    keepPlace(ids, { index: 1, progressMs: 252_000, at: now })
    expect(savedPlace(['t1', 'x2', 'x3', 'x4'], now)).toBeNull()
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
