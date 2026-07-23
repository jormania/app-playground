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
// plus whether they actually differ from what's stored. Always non-null on
// any successful Steam check (even when there's no price to report) so the
// caller can still stamp Price Updated At — that field means "did we check
// tonight", not "did we find a price".
export function resolvePriceUpdate(game, appData) {
  if (!appData || typeof appData !== 'object' || Array.isArray(appData)) return null
  if (!appData.success) return null

  const data = appData.data
  if (!data || Array.isArray(data)) return null

  if (data.price_overview) {
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

  if (data.is_free) {
    // Genuinely free — Steam only omits price_overview for free titles too,
    // so this has to be checked before falling through to "no price at all".
    const changed = priceChanged(0, game.currentPrice) || (game.discountPercent || 0) !== 0
    return { newPrice: 0, newInitial: null, newDiscount: 0, priceChanged: changed }
  }

  // Not free, no price_overview: Steam genuinely has no price to report —
  // most commonly a Coming Soon title with no pre-order price announced
  // yet, occasionally a delisted/no-longer-purchasable listing. This used
  // to fall into the free-game branch above and get written as a literal
  // $0.00, which is wrong — $0.00 means "confirmed free", not "unknown".
  // Never write anything here; a still-blank price stays blank, and an
  // existing real price is left alone rather than guessed at.
  return { newPrice: null, newInitial: null, newDiscount: null, priceChanged: false }
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
