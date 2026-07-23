import { test, expect, describe } from 'vitest'
import { priceChanged, resolvePriceUpdate, buildPatchProperties } from './clickdeckPricing.js'

describe('priceChanged', () => {
  test('treats sub-cent / sub-percent noise as unchanged', () => {
    expect(priceChanged(9.99, 9.9901)).toBe(false)
    expect(priceChanged(9.99, 10.99)).toBe(true)
  })
  test('a value appearing where there was none before counts as changed', () => {
    expect(priceChanged(9.99, null)).toBe(true)
    expect(priceChanged(9.99, undefined)).toBe(true)
  })
  test('null staying null is unchanged', () => {
    expect(priceChanged(null, null)).toBe(false)
  })
})

describe('resolvePriceUpdate', () => {
  const game = { currentPrice: 9.99, initialPrice: 9.99, discountPercent: 0 }

  test('returns null for a malformed or missing Steam entry (delisted appid returns [])', () => {
    expect(resolvePriceUpdate(game, undefined)).toBeNull()
    expect(resolvePriceUpdate(game, [])).toBeNull()
    expect(resolvePriceUpdate(game, { success: false })).toBeNull()
  })

  test('priceChanged: false when the stored price already matches Steam — this is the case the nightly cron and force-sync-prices.py both used to silently skip, leaving Price Updated At stuck forever on a stable-priced game', () => {
    const appData = { success: true, data: { price_overview: { final: 999, initial: 999, discount_percent: 0 } } }
    const update = resolvePriceUpdate(game, appData)
    expect(update).toEqual({ newPrice: 9.99, newInitial: 9.99, newDiscount: 0, priceChanged: false })
  })

  test('priceChanged: true when Steam reports a different price', () => {
    const appData = { success: true, data: { price_overview: { final: 499, initial: 999, discount_percent: 50 } } }
    const update = resolvePriceUpdate(game, appData)
    expect(update).toEqual({ newPrice: 4.99, newInitial: 9.99, newDiscount: 0.5, priceChanged: true })
  })

  test('is_free: true with no price_overview writes $0.00 and clears a stale sale', () => {
    const discountedGame = { currentPrice: 4.99, initialPrice: 9.99, discountPercent: 0.5 }
    const update = resolvePriceUpdate(discountedGame, { success: true, data: { is_free: true } })
    expect(update).toEqual({ newPrice: 0, newInitial: null, newDiscount: 0, priceChanged: true })
  })

  test('no-op when already free and no discount is stored', () => {
    const freeGame = { currentPrice: 0, initialPrice: null, discountPercent: 0 }
    const update = resolvePriceUpdate(freeGame, { success: true, data: { is_free: true } })
    expect(update.priceChanged).toBe(false)
  })

  test('not free, no price_overview (e.g. a Coming Soon title with no pre-order price yet) never writes $0.00 — leaves price fields untouched', () => {
    const blankGame = { currentPrice: null, initialPrice: null, discountPercent: null }
    const update = resolvePriceUpdate(blankGame, { success: true, data: { is_free: false } })
    expect(update).toEqual({ newPrice: null, newInitial: null, newDiscount: null, priceChanged: false })
  })

  test('not free, no price_overview never clobbers an existing real price with $0.00', () => {
    const pricedGame = { currentPrice: 19.99, initialPrice: 19.99, discountPercent: 0 }
    const update = resolvePriceUpdate(pricedGame, { success: true, data: {} })
    expect(update.priceChanged).toBe(false)
    expect(update.newPrice).toBeNull()
  })

  test('still returns a non-null result (so Price Updated At stamps) even with nothing to report', () => {
    const update = resolvePriceUpdate({ currentPrice: null }, { success: true, data: {} })
    expect(update).not.toBeNull()
  })
})

describe('buildPatchProperties', () => {
  const now = new Date('2026-07-22T02:00:00.000Z')

  test('always stamps Price Updated At, even when the price did not change — this is the fix: the field is "did we check", not "did the price move"', () => {
    const properties = buildPatchProperties({ newPrice: 9.99, newInitial: 9.99, newDiscount: 0, priceChanged: false }, now)
    expect(properties['Price Updated At']).toEqual({ date: { start: now.toISOString() } })
    expect(properties['Current Price']).toBeUndefined()
    expect(properties['Initial Price']).toBeUndefined()
    expect(properties['Discount Percent']).toBeUndefined()
  })

  test('includes the price fields only when they changed', () => {
    const properties = buildPatchProperties({ newPrice: 4.99, newInitial: 9.99, newDiscount: 0.5, priceChanged: true }, now)
    expect(properties['Current Price']).toEqual({ number: 4.99 })
    expect(properties['Initial Price']).toEqual({ number: 9.99 })
    expect(properties['Discount Percent']).toEqual({ number: 0.5 })
  })
})
