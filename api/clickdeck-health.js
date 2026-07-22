// On-demand diagnostic for [Settings] — not a cron, not a notification, just
// a manual "is Steam still reachable the way Click Deck needs it to be"
// button. Reuses the exact two endpoints the app actually depends on
// (appdetails for the nightly pricing cron, the search-page scrape for [W]'s
// "Find New Games" discovery) against known-good reference values, so a
// canary failure here means the real feature is broken too — not a
// synthetic check that could pass while the real thing fails.
import { originAllowed, rateLimited, clientIp } from './_shared.js'

// Loom — already used elsewhere in this codebase (steamMatch tests,
// PIVOT_TITLES) as a stable, unlikely-to-be-delisted reference title.
const KNOWN_APP_ID = 32340
const KNOWN_STUDIO = 'Wadjet Eye Games'

async function checkPricing() {
  try {
    const res = await fetch(`https://store.steampowered.com/api/appdetails?appids=${KNOWN_APP_ID}&cc=US&filters=price_overview`)
    if (!res.ok) return { ok: false, message: `Steam appdetails returned HTTP ${res.status}.` }
    const data = await res.json()
    const entry = data[String(KNOWN_APP_ID)]
    if (!entry || !entry.success) return { ok: false, message: 'Steam appdetails returned no data for the known reference title.' }
    return { ok: true, message: 'Steam appdetails reachable — the nightly pricing sync should be working.' }
  } catch (err) {
    return { ok: false, message: `Could not reach Steam appdetails: ${err.message}` }
  }
}

async function checkDiscovery() {
  try {
    const url = `https://store.steampowered.com/search/?term=${encodeURIComponent(KNOWN_STUDIO)}&l=english&cc=US`
    const res = await fetch(url)
    if (!res.ok) return { ok: false, message: `Steam search page returned HTTP ${res.status}.` }
    const html = await res.text()
    const appIds = [...new Set([...html.matchAll(/data-ds-appid="(\d+)"/g)].map(m => m[1]))]
    if (appIds.length === 0) return { ok: false, message: 'Steam search returned zero results for a known studio — [W]\'s discovery scrape may be broken.' }
    return { ok: true, message: `Steam search returned ${appIds.length} result(s) — [W]'s "Find New Games" should be working.` }
  } catch (err) {
    return { ok: false, message: `Could not reach Steam search: ${err.message}` }
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ message: 'Use GET to /api/clickdeck-health.' })
    return
  }

  if (!originAllowed(req.headers.origin)) {
    res.status(403).json({ message: 'Origin not allowed.' })
    return
  }

  if (rateLimited(clientIp(req))) {
    res.status(429).json({ message: 'Too many requests — try again shortly.' })
    return
  }

  const [pricing, discovery] = await Promise.all([checkPricing(), checkDiscovery()])
  res.status(200).json({ pricing, discovery, checkedAt: new Date().toISOString() })
}
