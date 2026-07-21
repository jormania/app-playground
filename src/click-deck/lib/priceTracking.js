// Small localStorage-backed helpers for two related "don't nag the user" behaviors:
// snoozing the discount banner, and detecting price drops between visits so we can
// toast about them without needing a server-side push mechanism.

const SNOOZE_KEY = 'cd_discount_snooze_until'
const PERSISTENT_KEY = 'cd_discount_banner_persistent'
const LAST_PRICES_KEY = 'cd_last_prices'

export function isDiscountBannerSnoozed(now = Date.now()) {
  const until = Number(localStorage.getItem(SNOOZE_KEY) || 0)
  return now < until
}

export function snoozeDiscountBanner(hours = 24, now = Date.now()) {
  localStorage.setItem(SNOOZE_KEY, String(now + hours * 60 * 60 * 1000))
}

// The safety net for an accidental dismiss: forces the banner back immediately,
// regardless of how much of the 24h snooze window remains.
export function clearDiscountBannerSnooze() {
  localStorage.removeItem(SNOOZE_KEY)
}

// Settings toggle: when on, the banner never auto-hides (the dismiss button
// and the 24h snooze it sets are both moot while this is active).
export function isDiscountBannerPersistent() {
  return localStorage.getItem(PERSISTENT_KEY) === 'true'
}

export function setDiscountBannerPersistent(value) {
  localStorage.setItem(PERSISTENT_KEY, value ? 'true' : 'false')
}

function readLastPrices() {
  try {
    return JSON.parse(localStorage.getItem(LAST_PRICES_KEY) || '{}')
  } catch {
    return {}
  }
}

// Compares each game's current price against the price we last saw for it (if any),
// returns the games whose price dropped, and persists the current prices for next time.
// A game with no previously-seen price is recorded but never reported as a "drop" —
// otherwise every game would look like a drop on first load.
export function detectPriceDrops(games) {
  const lastPrices = readLastPrices()
  const drops = []
  const nextPrices = { ...lastPrices }

  for (const game of games) {
    if (game.price === null || game.price === undefined) continue
    const previous = lastPrices[game.id]
    if (previous !== undefined && game.price < previous) {
      drops.push({ id: game.id, title: game.title, oldPrice: previous, newPrice: game.price })
    }
    nextPrices[game.id] = game.price
  }

  localStorage.setItem(LAST_PRICES_KEY, JSON.stringify(nextPrices))
  return drops
}
