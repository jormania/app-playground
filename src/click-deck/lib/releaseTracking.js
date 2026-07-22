// localStorage-backed helpers for the release banner's snooze/persistent
// behavior, mirroring priceTracking.js's discount-banner helpers exactly —
// same shape, own keys, so the two banners can never cross-interfere.

const SNOOZE_KEY = 'cd_release_snooze_until'
const PERSISTENT_KEY = 'cd_release_banner_persistent'

// How long a game stays in the "recently released" banner/[W] section after
// its Coming Soon -> Released transition. 365 days (not 30) so the very
// first production run already has something to show rather than an empty
// section for a month.
export const RECENTLY_RELEASED_WINDOW_DAYS = 365

export function isReleaseBannerSnoozed(now = Date.now()) {
  const until = Number(localStorage.getItem(SNOOZE_KEY) || 0)
  return now < until
}

export function snoozeReleaseBanner(hours = 24, now = Date.now()) {
  localStorage.setItem(SNOOZE_KEY, String(now + hours * 60 * 60 * 1000))
}

// Accidental-dismiss recovery — same pattern as clearDiscountBannerSnooze.
export function clearReleaseBannerSnooze() {
  localStorage.removeItem(SNOOZE_KEY)
}

export function isReleaseBannerPersistent() {
  return localStorage.getItem(PERSISTENT_KEY) === 'true'
}

export function setReleaseBannerPersistent(value) {
  localStorage.setItem(PERSISTENT_KEY, value ? 'true' : 'false')
}

// The one predicate shared by the banner AND [W]'s Recently Released group —
// deliberately the single source of truth so the two surfaces can never
// disagree about which games count. Released At is only ever stamped on an
// observed transition (never on a direct add of an already-out game), so
// this can't be fooled by a game that was simply added as already-released.
export function isRecentlyReleased(game, now = Date.now()) {
  if (!game.releasedAt) return false
  const releasedAtMs = new Date(game.releasedAt).getTime()
  if (Number.isNaN(releasedAtMs)) return false
  const windowMs = RECENTLY_RELEASED_WINDOW_DAYS * 24 * 60 * 60 * 1000
  const age = now - releasedAtMs
  // Guards against a corrupted/future-dated timestamp counting as "recent".
  return age >= 0 && age <= windowMs
}

export function getRecentlyReleasedGames(games, now = Date.now()) {
  return games
    .filter(g => isRecentlyReleased(g, now))
    .sort((a, b) => new Date(b.releasedAt) - new Date(a.releasedAt))
}

// Soonest-expected first: parsed year (nulls last), then the raw Steam date
// string as a tiebreak, then when it was added to the watchlist. Shared by
// [W]'s Coming Soon grid and the Stats screen's "next up" metric, so the two
// can't disagree about which game is "next."
export function sortComingSoonSoonestFirst(games) {
  return [...games].sort((a, b) => {
    const yearA = a.year || Infinity
    const yearB = b.year || Infinity
    if (yearA !== yearB) return yearA - yearB
    const dateA = a.releaseDate || ''
    const dateB = b.releaseDate || ''
    if (dateA !== dateB) return dateA.localeCompare(dateB)
    return new Date(a.createdTime) - new Date(b.createdTime)
  })
}

// The Timeline "NEW" ribbon — a tighter 30-day window than the 365-day
// banner/[W] one, so a card only reads as "just landed" for about a month
// rather than for the entire time it'd still show in Recently Released.
export function isRecentlyReleasedWithinDays(game, days, now = Date.now()) {
  if (!game.releasedAt) return false
  const releasedAtMs = new Date(game.releasedAt).getTime()
  if (Number.isNaN(releasedAtMs)) return false
  const age = now - releasedAtMs
  return age >= 0 && age <= days * 24 * 60 * 60 * 1000
}

const NUDGED_KEY = 'cd_watchlist_nudged_ids'

function readNudgedIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(NUDGED_KEY) || '[]'))
  } catch {
    return new Set()
  }
}

// Returns recently-released games this browser hasn't nudged about yet, and
// marks them nudged as a side effect — call once per games-load so the
// "add tags & notes?" prompt fires exactly once per game rather than every
// time the collection reloads.
export function takeUnnudgedRecentlyReleased(games) {
  const nudged = readNudgedIds()
  const fresh = getRecentlyReleasedGames(games).filter(g => !nudged.has(g.id))
  if (fresh.length > 0) {
    fresh.forEach(g => nudged.add(g.id))
    localStorage.setItem(NUDGED_KEY, JSON.stringify([...nudged]))
  }
  return fresh
}
