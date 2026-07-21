/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { isDiscountBannerSnoozed, snoozeDiscountBanner, detectPriceDrops } from './priceTracking'

describe('discount banner snooze', () => {
  beforeEach(() => localStorage.clear())

  it('is not snoozed by default', () => {
    expect(isDiscountBannerSnoozed()).toBe(false)
  })

  it('is snoozed immediately after snoozing, and until the window elapses', () => {
    const now = Date.now()
    snoozeDiscountBanner(24, now)
    expect(isDiscountBannerSnoozed(now)).toBe(true)
    expect(isDiscountBannerSnoozed(now + 23 * 60 * 60 * 1000)).toBe(true)
    expect(isDiscountBannerSnoozed(now + 24 * 60 * 60 * 1000 + 1)).toBe(false)
  })
})

describe('detectPriceDrops', () => {
  beforeEach(() => localStorage.clear())

  it('reports no drops on the very first sighting of a game', () => {
    const games = [{ id: '1', title: 'A', price: 9.99 }]
    expect(detectPriceDrops(games)).toEqual([])
  })

  it('detects a drop against the previously recorded price', () => {
    detectPriceDrops([{ id: '1', title: 'A', price: 19.99 }])
    const drops = detectPriceDrops([{ id: '1', title: 'A', price: 9.99 }])
    expect(drops).toEqual([{ id: '1', title: 'A', oldPrice: 19.99, newPrice: 9.99 }])
  })

  it('does not report a price increase or an unchanged price as a drop', () => {
    detectPriceDrops([{ id: '1', title: 'A', price: 9.99 }])
    expect(detectPriceDrops([{ id: '1', title: 'A', price: 14.99 }])).toEqual([])
    expect(detectPriceDrops([{ id: '1', title: 'A', price: 14.99 }])).toEqual([])
  })

  it('ignores games with no known price', () => {
    const games = [{ id: '1', title: 'A', price: null }, { id: '2', title: 'B', price: undefined }]
    expect(detectPriceDrops(games)).toEqual([])
  })

  it('tracks multiple games independently', () => {
    detectPriceDrops([{ id: '1', title: 'A', price: 10 }, { id: '2', title: 'B', price: 20 }])
    const drops = detectPriceDrops([{ id: '1', title: 'A', price: 5 }, { id: '2', title: 'B', price: 20 }])
    expect(drops).toEqual([{ id: '1', title: 'A', oldPrice: 10, newPrice: 5 }])
  })
})
