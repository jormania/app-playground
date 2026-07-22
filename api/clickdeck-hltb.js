import { originAllowed, rateLimited, clientIp } from './_shared.js'

// HowLongToBeat has no official API. Their search page does a two-step
// handshake: GET /api/bleed/init (returns a token + a one-off {hpKey: hpVal}
// pair bound to this request's IP/UA), then POST /api/bleed with that token
// in headers AND the hpKey/hpVal pair echoed back as an extra top-level body
// property — both steps must happen from the same origin IP, which is
// naturally true here since both run inside one function invocation.
// Reverse-engineered from howlongtobeat.com's own JS bundle (2026-07-22) —
// the single most likely thing to break if HLTB changes their bundle. Every
// failure here is caught and surfaced as a clear error rather than thrown,
// so a broken scrape degrades to "enter Length (hrs) manually in the
// Editor" instead of taking anything else down with it.
const HLTB_BASE = 'https://howlongtobeat.com'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36'

async function getSearchInit() {
  const res = await fetch(`${HLTB_BASE}/api/bleed/init?t=${Date.now()}`, {
    headers: { 'User-Agent': UA, 'Referer': `${HLTB_BASE}/` }
  })
  if (!res.ok) throw new Error(`HLTB init returned ${res.status}`)
  const data = await res.json()
  if (!data || !data.token || !data.hpKey) throw new Error('HLTB init response missing token/hpKey — their search handshake likely changed.')
  return data
}

async function searchHltb(term, init) {
  const body = {
    searchType: 'games',
    searchTerms: term.trim().split(/\s+/).filter(Boolean),
    searchPage: 1,
    size: 20,
    searchOptions: {
      games: {
        userId: 0, platform: '', sortCategory: 'popular', rangeCategory: 'main',
        rangeTime: { min: null, max: null },
        gameplay: { perspective: '', flow: '', genre: '', difficulty: '' },
        rangeYear: { min: '', max: '' },
        modifier: ''
      },
      users: { sortCategory: 'postcount' },
      lists: { sortCategory: 'follows' },
      filter: '', sort: 0, randomizer: 0
    },
    useCache: true,
    [init.hpKey]: init.hpVal
  }

  const res = await fetch(`${HLTB_BASE}/api/bleed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': UA,
      'Referer': `${HLTB_BASE}/`,
      'x-auth-token': init.token,
      'x-hp-key': init.hpKey,
      'x-hp-val': init.hpVal
    },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`HLTB search returned ${res.status}`)
  const data = await res.json()
  return Array.isArray(data?.data) ? data.data : []
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ message: 'Use GET to /api/clickdeck-hltb.' })
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

  const { term } = req.query || {}
  if (!term || typeof term !== 'string') {
    res.status(400).json({ message: 'Missing search term.' })
    return
  }

  try {
    const init = await getSearchInit()
    const results = await searchHltb(term, init)
    // comp_plus is HLTB's "Main + Extra" stat — the app calls it "Main +
    // Sides", same underlying number, friendlier label. A less-played or
    // newer title can have zero submissions for that specific stat while
    // still having a real "Main Story" (comp_main) number on file — falling
    // back to that rather than excluding the game outright (confirmed live:
    // "Midnight Scenes: Among Graves" only has comp_main, comp_plus reads 0).
    // Only omitted when NEITHER stat has any data at all.
    const items = results
      .map(g => {
        const seconds = g.comp_plus > 0 ? g.comp_plus : g.comp_main
        return seconds > 0 ? { id: g.game_id, name: g.game_name, hours: Math.round((seconds / 3600) * 10) / 10 } : null
      })
      .filter(Boolean)
    res.status(200).json({ items })
  } catch (err) {
    res.status(502).json({ message: `Could not reach HowLongToBeat: ${err.message}` })
  }
}
