/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest'
import {
  isReleaseBannerSnoozed, snoozeReleaseBanner, clearReleaseBannerSnooze,
  isReleaseBannerPersistent, setReleaseBannerPersistent,
  isRecentlyReleased, getRecentlyReleasedGames, isRecentlyReleasedWithinDays,
  takeUnnudgedRecentlyReleased, RECENTLY_RELEASED_WINDOW_DAYS
} from './releaseTracking'

describe('release banner snooze (own key, independent of the discount banner)', () => {
  beforeEach(() => localStorage.clear())

  it('is not snoozed by default', () => {
    expect(isReleaseBannerSnoozed()).toBe(false)
  })

  it('snoozing hides it for the given number of hours, then it reappears', () => {
    const now = Date.now()
    snoozeReleaseBanner(24, now)
    expect(isReleaseBannerSnoozed(now + 1000)).toBe(true)
    expect(isReleaseBannerSnoozed(now + 25 * 60 * 60 * 1000)).toBe(false)
  })

  it('clearReleaseBannerSnooze recovers an accidental dismiss immediately', () => {
    snoozeReleaseBanner(24)
    expect(isReleaseBannerSnoozed()).toBe(true)
    clearReleaseBannerSnooze()
    expect(isReleaseBannerSnoozed()).toBe(false)
  })

  it('uses its own localStorage key, not the discount banner\'s', () => {
    snoozeReleaseBanner(24)
    expect(localStorage.getItem('cd_discount_snooze_until')).toBeNull()
    expect(localStorage.getItem('cd_release_snooze_until')).not.toBeNull()
  })
})

describe('release banner persistent mode', () => {
  beforeEach(() => localStorage.clear())

  it('defaults to off', () => {
    expect(isReleaseBannerPersistent()).toBe(false)
  })

  it('toggles independently of the discount banner\'s persistent flag', () => {
    setReleaseBannerPersistent(true)
    expect(isReleaseBannerPersistent()).toBe(true)
    expect(localStorage.getItem('cd_discount_banner_persistent')).toBeNull()
  })
})

describe('isRecentlyReleased / getRecentlyReleasedGames', () => {
  const now = new Date('2026-07-22T00:00:00.000Z').getTime()

  it('false for a game with no Released At at all', () => {
    expect(isRecentlyReleased({ releasedAt: null }, now)).toBe(false)
    expect(isRecentlyReleased({}, now)).toBe(false)
  })

  it('true within the 365-day window, false just past it', () => {
    const within = new Date(now - 100 * 24 * 60 * 60 * 1000).toISOString()
    const justOutside = new Date(now - (RECENTLY_RELEASED_WINDOW_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString()
    expect(isRecentlyReleased({ releasedAt: within }, now)).toBe(true)
    expect(isRecentlyReleased({ releasedAt: justOutside }, now)).toBe(false)
  })

  it('rejects a future-dated (corrupted/clock-skew) Released At rather than treating it as recent', () => {
    const future = new Date(now + 1000 * 60 * 60).toISOString()
    expect(isRecentlyReleased({ releasedAt: future }, now)).toBe(false)
  })

  it('an already-Released game added directly (Released At never stamped) never shows up — this is the guard against finding #1', () => {
    const directAdd = { title: 'Old Game', releaseStatus: 'Released', releasedAt: null }
    expect(isRecentlyReleased(directAdd, now)).toBe(false)
    expect(getRecentlyReleasedGames([directAdd], now)).toEqual([])
  })

  it('sorts most-recently-released first', () => {
    const older = { id: 'a', releasedAt: new Date(now - 50 * 24 * 60 * 60 * 1000).toISOString() }
    const newer = { id: 'b', releasedAt: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString() }
    expect(getRecentlyReleasedGames([older, newer], now).map(g => g.id)).toEqual(['b', 'a'])
  })
})

describe('isRecentlyReleasedWithinDays (the Timeline NEW-ribbon window)', () => {
  const now = new Date('2026-07-22T00:00:00.000Z').getTime()

  it('true inside the given window, false just outside it, independent of the 365-day one', () => {
    const tenDaysAgo = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString()
    expect(isRecentlyReleasedWithinDays({ releasedAt: tenDaysAgo }, 30, now)).toBe(true)
    expect(isRecentlyReleasedWithinDays({ releasedAt: tenDaysAgo }, 5, now)).toBe(false)
    // Still within the 365-day banner window, but well outside a 30-day ribbon window.
    const fortyDaysAgo = new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString()
    expect(isRecentlyReleasedWithinDays({ releasedAt: fortyDaysAgo }, 30, now)).toBe(false)
  })
})

describe('takeUnnudgedRecentlyReleased', () => {
  beforeEach(() => localStorage.clear())
  const now = Date.now()
  const game = { id: 'g1', releasedAt: new Date(now - 1000).toISOString() }

  it('returns a freshly-released game the first time, and never again after', () => {
    const first = takeUnnudgedRecentlyReleased([game])
    expect(first.map(g => g.id)).toEqual(['g1'])

    const second = takeUnnudgedRecentlyReleased([game])
    expect(second).toEqual([])
  })
})
