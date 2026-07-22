// Treat sub-cent / sub-percent differences as unchanged so floating-point noise
// (and null vs. absent) doesn't trigger a needless rewrite of the price fields
// every night. Price Updated At still gets patched on every successful Steam
// check regardless — it's the "did we actually check" signal, not a "did the
// price move" signal, and StatsView's sync indicator depends on that distinction.
export function priceChanged(next, prev) {
  if (prev === null || prev === undefined) return next !== null && next !== undefined
  return Math.abs(Number(next) - Number(prev)) > 0.001
}

// Given one Notion-side game row (currentPrice/initialPrice/discountPercent)
// and the raw Steam appdetails response entry for its App ID, decides what
// (if anything) should be written back. Returns null when the entry can't be
// used at all (missing, malformed, or Steam reported failure for that App
// ID — delisted/region-locked); otherwise returns the resolved price fields
// plus whether they actually differ from what's stored.
export function resolvePriceUpdate(game, appData) {
  if (!appData || typeof appData !== 'object' || Array.isArray(appData)) return null
  if (!appData.success) return null

  const data = appData.data
  if (data && !Array.isArray(data) && data.price_overview) {
    // Steam reports money in cents (999 -> $9.99) and discount as a whole
    // percent (55). Stored as the fraction (0.55) to match the Notion
    // "Discount Percent" percent-format column.
    const po = data.price_overview
    const newPrice = po.final / 100
    const newInitial = po.initial / 100
    const newDiscount = (po.discount_percent || 0) / 100
    const changed = priceChanged(newPrice, game.currentPrice) ||
      priceChanged(newInitial, game.initialPrice) ||
      priceChanged(newDiscount, game.discountPercent)
    return { newPrice, newInitial, newDiscount, priceChanged: changed }
  }

  // success: true with no price_overview means free or no longer
  // purchasable — clear any stale sale rather than leaving it stuck.
  const changed = priceChanged(0, game.currentPrice) || (game.discountPercent || 0) !== 0
  return { newPrice: 0, newInitial: null, newDiscount: 0, priceChanged: changed }
}

// Builds the Notion PATCH properties for a resolved update. Price Updated At
// always stamps — it's the "we checked this game tonight" signal StatsView's
// sync indicator depends on — while the price/discount fields only get
// rewritten when they actually changed, so a stable-priced game doesn't
// churn Notion's edit history every night.
export function buildPatchProperties(update, now = new Date()) {
  const properties = {
    'Price Updated At': { date: { start: now.toISOString() } }
  }
  if (update.priceChanged) {
    properties['Current Price'] = { number: update.newPrice }
    properties['Initial Price'] = { number: update.newInitial }
    properties['Discount Percent'] = { number: update.newDiscount }
  }
  return properties
}
