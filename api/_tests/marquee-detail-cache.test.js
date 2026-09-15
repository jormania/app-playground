// The detail-page cache — the answer to TNB serving a bot check (2026-09-15).
//
// The thing under test is a NEGATIVE: the request that is no longer made. So
// most of these assert on what the fake fetch was asked for, not on what came
// back. TNB carries the detailed cases — it is the venue whose 61-requests-per-
// scan poster hop tripped the bot check — while the last two blocks cover the
// other two adapters that opt in, and the boundary that decides who may.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import tnb from '../_lib/marquee/tnb.js'
import { ADAPTERS } from '../_lib/marquee/registry.js'
import { scanVenue, STATUS, DETAIL_BUDGET_PER_SCAN } from '../_lib/marquee/scan.js'
import { isFresh, loadDetails, saveDetails, DEFAULT_TTL_MS } from '../_lib/marquee/detailCache.js'

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '../_lib/marquee/__fixtures__')
const fixture = (name) => readFileSync(join(FIXTURES, name), 'utf8')

const NOW = new Date('2026-09-15T09:00:00Z')
const VENUE = { name: 'Teatrul Național București', url: 'https://www.tnb.ro/ro/bilete-online', adapter: 'tnb' }

const PLACEBO = 'https://www.tnb.ro/ro/defectul-placebo-2026'
const LUIZA = 'https://www.tnb.ro/ro/concert-luiza-zan-muse-quartet'

/** A listing with enough distinct showings to clear tnb's `minItems: 15`, so the
 *  health gate passes and these tests exercise a REAL scan rather than a broken
 *  one.
 *
 *  Three productions playing on six nights each — TNB's actual shape, and the
 *  shape that makes the cache worth having at all: the detail hop is one per
 *  PRODUCTION, so eighteen showings cost three requests cold and none warm. The
 *  dates and times have to vary or `dedupe` folds the rows into three events
 *  (`eventKey` is date + time + title) and the gate rightly calls that broken. */
function listing(urls = [PLACEBO, LUIZA, 'https://www.tnb.ro/ro/micul-print-2026']) {
  const days = []
  for (let d = 0; d < 6; d++) {
    const rows = urls.map((url, i) => `<tr><td class="title"><a href="${url}"><h1>Production ${i}</h1></a></td><td class="c2">Sala Mică</td><td class="c3">${18 + i}:00</td><td><a href="https://www.bilet.ro/x" class="red_button">Bilete</a></td></tr>`)
    days.push(`<div class="day"><div class="number">${20 + d}</div><div class="month">09</div><div class="year">2026</div>${rows.join('')}</div>`)
  }
  return days.join('')
}

const DETAIL_BODY = {
  [PLACEBO]: fixture('tnb-detail-placebo.html'),
  [LUIZA]: fixture('tnb-detail-luiza-zan.html'),
  'https://www.tnb.ro/ro/micul-print-2026': fixture('tnb-detail-og-image.html'),
}

/** A fetch that records every call, so a test can assert on the request that
 *  never happened. `detail` lets one test override how detail pages answer. */
function recordingFetch({ detail } = {}) {
  const calls = []
  const impl = async (url, init) => {
    calls.push({ url, headers: init?.headers ?? {} })
    if (url === VENUE.url) {
      return { ok: true, status: 200, headers: new Headers(), text: async () => listing() }
    }
    if (detail) return detail(url, init)
    return {
      ok: true,
      status: 200,
      headers: new Headers({ etag: `"v1-${url.slice(-8)}"`, 'last-modified': 'Mon, 01 Sep 2026 10:00:00 GMT' }),
      text: async () => DETAIL_BODY[url] ?? '<html></html>',
    }
  }
  return { impl, calls, detailCalls: () => calls.filter((c) => c.url !== VENUE.url) }
}

/** An in-memory stand-in for KV. */
function memoryStore(seed = {}) {
  const data = { ...seed }
  return {
    data,
    get: async (key) => data[key] ?? null,
    set: async (key, value) => { data[key] = value; return true },
  }
}

const KEY = 'marquee:details:v1:tnb'
const record = (url, fetchedAt, extra = {}) => ({
  url,
  data: { image: 'https://www.tnb.ro/remembered.jpg', description: 'A remembered synopsis.', price: 55 },
  etag: '"cached"',
  lastModified: 'Mon, 01 Sep 2026 10:00:00 GMT',
  fetchedAt,
  ...extra,
})

describe('detail cache — the request that is no longer made', () => {
  it('skips the fetch entirely for a production whose record is still fresh', async () => {
    const yesterday = new Date(NOW.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const store = memoryStore({
      [KEY]: {
        [PLACEBO]: record(PLACEBO, yesterday),
        [LUIZA]: record(LUIZA, yesterday),
        'https://www.tnb.ro/ro/micul-print-2026': record('https://www.tnb.ro/ro/micul-print-2026', yesterday),
      },
    })
    const fetcher = recordingFetch()

    const result = await scanVenue(VENUE, { now: NOW, fetchImpl: fetcher.impl, detailStore: store })

    expect(result.status).toBe(STATUS.OK)
    // The listing, and nothing else. This one assertion is the whole point of
    // the feature: what used to be one listing plus a detail page per
    // production is now one request.
    expect(fetcher.calls).toHaveLength(1)
    expect(fetcher.detailCalls()).toHaveLength(0)
    // And the remembered poster/price/synopsis still reach the events, so the
    // saving costs the user nothing visible.
    expect(result.events[0].image).toBe('https://www.tnb.ro/remembered.jpg')
    expect(result.events[0].price).toBe(55)
    expect(result.events[0].description).toBe('A remembered synopsis.')
  })

  it('reads every detail page when the cache is cold, and remembers what it read', async () => {
    const store = memoryStore()
    const fetcher = recordingFetch()

    const result = await scanVenue(VENUE, { now: NOW, fetchImpl: fetcher.impl, detailStore: store })

    expect(result.status).toBe(STATUS.OK)
    expect(fetcher.detailCalls()).toHaveLength(3)

    const saved = store.data[KEY]
    expect(Object.keys(saved).sort()).toEqual([LUIZA, 'https://www.tnb.ro/ro/micul-print-2026', PLACEBO].sort())
    // The EXTRACTED record, never the HTML — the reason this fits in one KV
    // value at all. A stored entry must stay in the kilobyte range.
    expect(saved[PLACEBO].data).toEqual({
      image: 'https://www.tnb.ro/uploads/articles/2943/2686/small_large_Afis_placebo_2022-Nou13.jpg',
      description: expect.any(String),
      price: null, // this production's page carries no price_box — a real absence, not a miss
    })
    expect(JSON.stringify(saved[PLACEBO]).length).toBeLessThan(2048)
    expect(saved[PLACEBO].etag).toBe(`"v1-${PLACEBO.slice(-8)}"`)
    // The one fixture that DOES publish a tiered price — proving the cheapest
    // tier survives the round trip into the store, not just the poster.
    expect(saved['https://www.tnb.ro/ro/micul-print-2026'].data.price).toBeGreaterThan(0)
  })

  it('a warm cache and a cold one produce identical events', async () => {
    // The property that makes this safe to ship: the cache is invisible. Two
    // scans, one reading three detail pages and one reading none, must agree on
    // every field of every event — poster, price and synopsis included.
    const cold = await scanVenue(VENUE, { now: NOW, fetchImpl: recordingFetch().impl, detailStore: memoryStore() })

    const store = memoryStore()
    await scanVenue(VENUE, { now: NOW, fetchImpl: recordingFetch().impl, detailStore: store })
    const fetcher = recordingFetch()
    const warm = await scanVenue(VENUE, { now: NOW, fetchImpl: fetcher.impl, detailStore: store })

    expect(fetcher.detailCalls()).toHaveLength(0)
    expect(warm.events).toEqual(cold.events)
    expect(warm.events.some((e) => e.image)).toBe(true)
  })
})

describe('detail cache — conditional requests', () => {
  it('re-asks with If-None-Match and If-Modified-Since once a record goes stale', async () => {
    const longAgo = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const store = memoryStore({ [KEY]: { [PLACEBO]: record(PLACEBO, longAgo) } })
    const fetcher = recordingFetch()

    await scanVenue(VENUE, { now: NOW, fetchImpl: fetcher.impl, detailStore: store })

    const placebo = fetcher.calls.find((c) => c.url === PLACEBO)
    expect(placebo.headers['if-none-match']).toBe('"cached"')
    expect(placebo.headers['if-modified-since']).toBe('Mon, 01 Sep 2026 10:00:00 GMT')
  })

  it('never sends a validator for a page it holds no record of', async () => {
    const fetcher = recordingFetch()
    await scanVenue(VENUE, { now: NOW, fetchImpl: fetcher.impl, detailStore: memoryStore() })

    for (const call of fetcher.calls) {
      expect(call.headers['if-none-match']).toBeUndefined()
      expect(call.headers['if-modified-since']).toBeUndefined()
    }
  })

  it('never sends a validator on the LISTING page, where a 304 would mean no programme', async () => {
    // The trap this guards: the listing is the programme. A 304 there is an
    // empty body, an empty body parses to nothing, and the venue would report
    // as broken for not having changed since breakfast.
    const yesterday = new Date(NOW.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const store = memoryStore({ [KEY]: { [VENUE.url]: record(VENUE.url, yesterday) } })
    const fetcher = recordingFetch()

    await scanVenue(VENUE, { now: NOW, fetchImpl: fetcher.impl, detailStore: store })

    const listingCall = fetcher.calls.find((c) => c.url === VENUE.url)
    expect(listingCall.headers['if-none-match']).toBeUndefined()
    expect(listingCall.headers['if-modified-since']).toBeUndefined()
  })

  it('a 304 keeps the record and resets its age, so an unchanging page is not re-read forever', async () => {
    const longAgo = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const store = memoryStore({ [KEY]: { [PLACEBO]: record(PLACEBO, longAgo) } })
    const fetcher = recordingFetch({
      detail: async (url) => (url === PLACEBO
        ? { ok: false, status: 304, headers: new Headers() }
        : { ok: true, status: 200, headers: new Headers(), text: async () => DETAIL_BODY[url] ?? '<html></html>' }),
    })

    const result = await scanVenue(VENUE, { now: NOW, fetchImpl: fetcher.impl, detailStore: store })

    expect(result.status).toBe(STATUS.OK)
    // The remembered values survived a bodyless response...
    expect(result.events.find((e) => e.link === PLACEBO).image).toBe('https://www.tnb.ro/remembered.jpg')
    // ...and the record is young again.
    expect(store.data[KEY][PLACEBO].fetchedAt).toBe(NOW.toISOString())
    expect(store.data[KEY][PLACEBO].data.price).toBe(55)
  })
})

describe('detail cache — when things go wrong', () => {
  it('keeps the last good record when a detail page fails, rather than stripping the poster', async () => {
    const longAgo = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const store = memoryStore({ [KEY]: { [PLACEBO]: record(PLACEBO, longAgo) } })
    const fetcher = recordingFetch({
      detail: async (url) => (url === PLACEBO
        ? { ok: false, status: 503, headers: new Headers(), text: async () => '' }
        : { ok: true, status: 200, headers: new Headers(), text: async () => DETAIL_BODY[url] ?? '<html></html>' }),
    })

    const result = await scanVenue(VENUE, { now: NOW, fetchImpl: fetcher.impl, detailStore: store })

    expect(result.events.find((e) => e.link === PLACEBO).image).toBe('https://www.tnb.ro/remembered.jpg')
    // Kept, but NOT rejuvenated — it is still due for a re-read next scan.
    expect(store.data[KEY][PLACEBO].fetchedAt).toBe(longAgo)
  })

  it('a store that throws is a cache miss, never a failed scan', async () => {
    const angry = {
      get: async () => { throw new Error('KV is having a moment') },
      set: async () => { throw new Error('KV is still having a moment') },
    }
    const fetcher = recordingFetch()

    const result = await scanVenue(VENUE, { now: NOW, fetchImpl: fetcher.impl, detailStore: angry })

    expect(result.status).toBe(STATUS.OK)
    expect(result.events).toHaveLength(18)
    expect(fetcher.detailCalls()).toHaveLength(3)
  })

  it('drops a production that has left the calendar instead of storing it forever', async () => {
    const yesterday = new Date(NOW.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const gone = 'https://www.tnb.ro/ro/a-production-that-closed'
    const store = memoryStore({ [KEY]: { [gone]: record(gone, yesterday) } })

    await scanVenue(VENUE, { now: NOW, fetchImpl: recordingFetch().impl, detailStore: store })

    expect(Object.keys(store.data[KEY])).not.toContain(gone)
  })

  it('an adapter that throws while extracting loses one poster, not its venue', async () => {
    const store = memoryStore()
    const original = tnb.extractDetail
    tnb.extractDetail = (page) => {
      if (page.url === PLACEBO) throw new Error('bad regex day')
      return original.call(tnb, page)
    }
    try {
      const result = await scanVenue(VENUE, { now: NOW, fetchImpl: recordingFetch().impl, detailStore: store })
      expect(result.status).toBe(STATUS.OK)
      expect(Object.keys(store.data[KEY])).not.toContain(PLACEBO)
      // The page itself was still fetched and still parsed, so the event keeps
      // its poster this time round — only the remembering was lost.
      expect(result.events.find((e) => e.link === PLACEBO).image).toContain('Afis_placebo')
    } finally {
      tnb.extractDetail = original
    }
  })
})

describe('freshness', () => {
  it('trusts a record inside the window and distrusts one past it', () => {
    const url = 'https://www.tnb.ro/ro/x'
    const young = { url, fetchedAt: new Date(NOW.getTime() - 60 * 60 * 1000).toISOString() }
    const old = { url, fetchedAt: new Date(NOW.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString() }
    expect(isFresh(young, NOW)).toBe(true)
    expect(isFresh(old, NOW)).toBe(false)
  })

  it('refuses a record with no timestamp, a broken one, or one from the future', () => {
    expect(isFresh(null, NOW)).toBe(false)
    expect(isFresh({ url: 'x' }, NOW)).toBe(false)
    expect(isFresh({ url: 'x', fetchedAt: 'not a date' }, NOW)).toBe(false)
    expect(isFresh({ url: 'x', fetchedAt: '2027-01-01T00:00:00.000Z' }, NOW)).toBe(false)
  })

  it('spreads expiry across URLs, so a whole season does not go cold in one scan', () => {
    // Without this, sixty records written in one scan expire in one scan a week
    // later — the cache would work six days in seven and reproduce the exact
    // 61-request burst it exists to prevent on the seventh.
    // A day past the TTL, which sits in the middle of the two-day spread: some
    // URLs are due, some are not, which is the whole behaviour.
    const justPastTtl = new Date(NOW.getTime() - DEFAULT_TTL_MS - 24 * 60 * 60 * 1000).toISOString()
    const verdicts = Array.from({ length: 40 }, (_, i) =>
      isFresh({ url: `https://www.tnb.ro/ro/production-${i}`, fetchedAt: justPastTtl }, NOW))
    expect(verdicts).toContain(true)
    expect(verdicts).toContain(false)
  })

  it('gives the same URL the same spread every time — a stable offset, not a re-roll', () => {
    const entry = { url: 'https://www.tnb.ro/ro/steady', fetchedAt: new Date(NOW.getTime() - DEFAULT_TTL_MS - 3600000).toISOString() }
    const once = isFresh(entry, NOW)
    for (let i = 0; i < 20; i++) expect(isFresh(entry, NOW)).toBe(once)
  })
})

describe('the store itself', () => {
  it('reads an absent, malformed or array value as an empty cache', async () => {
    expect(await loadDetails('tnb', { store: memoryStore() })).toEqual({})
    expect(await loadDetails('tnb', { store: memoryStore({ [KEY]: 'nonsense' }) })).toEqual({})
    expect(await loadDetails('tnb', { store: memoryStore({ [KEY]: [1, 2, 3] }) })).toEqual({})
    expect(await loadDetails('', { store: memoryStore() })).toEqual({})
  })

  it('bounds what it keeps, newest first, so a long-lived store cannot grow without limit', async () => {
    const entries = {}
    for (let i = 0; i < 500; i++) {
      entries[`https://www.tnb.ro/ro/p${i}`] = record(`https://www.tnb.ro/ro/p${i}`, new Date(NOW.getTime() - i * 1000).toISOString())
    }
    const store = memoryStore()
    await saveDetails('tnb', entries, { store })

    const kept = store.data[KEY]
    expect(Object.keys(kept)).toHaveLength(400)
    // The oldest are the ones dropped.
    expect(kept['https://www.tnb.ro/ro/p0']).toBeTruthy()
    expect(kept['https://www.tnb.ro/ro/p499']).toBeUndefined()
  })

  it('writing nothing is not a write', async () => {
    const store = memoryStore()
    expect(await saveDetails('tnb', {}, { store })).toBe(false)
    expect(store.data[KEY]).toBeUndefined()
  })
})

describe('the cache boundary — which venues may remember, and which may not', () => {
  // The enforced half of detailCache.js's rule, in the spirit of
  // src/ds/boundary.test.js: a new adapter that opts into caching has to come
  // past this list, and a venue that must stay ephemeral cannot drift into it
  // by someone copying `extractDetail` from the venue above.
  const MAY_CACHE = ['tnb', 'metropolis', 'arcub']

  const MUST_NOT_CACHE = {
    // Their extra hops ARE the programme — caching those caches the answer
    // rather than the lookup.
    eventbook: 'follows its own pagination; every page is more showings',
    oveit: 'follows a paged event feed; every page is more concerts',
    iabilet: 'follows bundle children whose tariff accordion holds the showings',
    // The instructive one: detail pages of exactly TNB's shape, which a later
    // hop still needs in hand.
    excelsior: 'enrich mines each detail page for eiIds and posts a live seat lookup per showing',
  }

  it('only the adapters on the roster declare extractDetail', () => {
    const declaring = Object.entries(ADAPTERS)
      .filter(([, adapter]) => typeof adapter.extractDetail === 'function')
      .map(([id]) => id)
      .sort()
    expect(declaring).toEqual([...MAY_CACHE].sort())
  })

  it.each(Object.entries(MUST_NOT_CACHE))('%s stays ephemeral — %s', (id) => {
    expect(ADAPTERS[id].extractDetail).toBeUndefined()
  })

  it('every adapter that caches also follows — there is nothing else to cache', () => {
    for (const id of MAY_CACHE) {
      expect(typeof ADAPTERS[id].follow).toBe('function')
    }
  })

  it('no cached record carries a fact about a SHOWING', () => {
    // Rule 2, the one with teeth: a stale poster is a cosmetic miss, a stale
    // "tickets available" sends someone to a sold-out night. Whatever else the
    // records grow, these keys must never appear among them.
    const volatile = ['ticketState', 'ticketsUrl', 'seatsLeft', 'seatsTotal', 'date', 'time', 'isAvailable']
    const samples = {
      tnb: { url: 'https://www.tnb.ro/ro/x', body: fixture('tnb-detail-og-image.html') },
      metropolis: { url: 'https://teatrulmetropolis.ro/x', body: fixture('metropolis-production.html') },
      arcub: { url: 'https://arcub.ro/x', body: fixture('arcub-detail-cineva-are-sa-vina.html') },
    }
    for (const [id, page] of Object.entries(samples)) {
      const record = ADAPTERS[id].extractDetail(page)
      expect(Object.keys(record).some((k) => volatile.includes(k))).toBe(false)
      // And small — this has to fit alongside sixty siblings in one KV value.
      expect(JSON.stringify(record).length).toBeLessThan(4096)
    }
  })
})

describe('the other two venues that now remember', () => {
  it('metropolis keeps a production price and stops re-asking for it', async () => {
    const venue = { name: 'Teatrul Metropolis', url: 'https://teatrulmetropolis.ro/program/', adapter: 'metropolis' }
    const programme = fixture('metropolis-program.html')
    const detail = fixture('metropolis-production.html')

    const calls = []
    const impl = async (url) => {
      calls.push(url)
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () => (url === venue.url ? programme : detail),
      }
    }

    const store = memoryStore()
    const cold = await scanVenue(venue, { now: NOW, fetchImpl: impl, detailStore: store })
    const coldCalls = calls.length
    expect(coldCalls).toBeGreaterThan(1)

    const saved = store.data['marquee:details:v1:metropolis']
    expect(Object.values(saved).some((e) => e.data.price > 0)).toBe(true)

    calls.length = 0
    const warm = await scanVenue(venue, { now: NOW, fetchImpl: impl, detailStore: store })
    expect(calls).toEqual([venue.url])
    expect(warm.events).toEqual(cold.events)
  })

  it('arcub keeps a description and stops re-asking for it', async () => {
    const venue = { name: 'ARCUB', url: 'https://arcub.ro/agenda/', adapter: 'arcub' }
    const agenda = fixture('arcub.html')
    const detail = fixture('arcub-detail-cineva-are-sa-vina.html')

    const calls = []
    const impl = async (url) => {
      calls.push(url)
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () => (url === venue.url ? agenda : detail),
      }
    }

    const store = memoryStore()
    const cold = await scanVenue(venue, { now: NOW, fetchImpl: impl, detailStore: store })
    expect(calls.length).toBeGreaterThan(1)

    const saved = store.data['marquee:details:v1:arcub']
    expect(Object.values(saved).some((e) => typeof e.data.description === 'string')).toBe(true)

    calls.length = 0
    const warm = await scanVenue(venue, { now: NOW, fetchImpl: impl, detailStore: store })
    expect(calls).toEqual([venue.url])
    expect(warm.events).toEqual(cold.events)
  })

  it('arcub caps its follow, like every other multi-hop reader', () => {
    // It was the one that didn't. An agenda page whose markup shifts and starts
    // matching every href on the page must not become a hundred requests.
    const manyItems = Array.from({ length: 200 }, (_, i) =>
      `<div class="agenda-item"><a href="/eveniment-${i}">x</a><h3>Event ${i}</h3></div>`).join('')
    const requests = ADAPTERS.arcub.follow([{ url: 'x', body: manyItems }], { venue: { url: 'x' } })
    expect(requests.length).toBeLessThanOrEqual(40)
  })
})

describe('the cold-start trap (§9.78) — the cache has to be able to warm up', () => {
  // Found in production, a day after the cache shipped: TNB still reported a
  // bot check on every run. The cache was not being bypassed, it was EMPTY —
  // and could not stop being empty. It only fills on a scan whose listing gets
  // through, and that scan was then firing all 61 detail requests at once,
  // which is what trips the limiter again. Blocked, one request, nothing
  // stored; block lapses, 61 requests, blocked. Round and round.

  const CHALLENGE = `<html><title>Just a moment...</title><body>${'<p>One moment, please. Enable JavaScript and cookies to continue.</p>'.repeat(40)}</body></html>`
  const DETAIL = `<html><img class="article-image" src="/poster.jpg"><div class="price_box"><p>80 lei</p></div><p>${'A real synopsis for this production, long enough to count as prose. '.repeat(3)}</p></html>`

  /** A season of `n` productions, each playing six nights. */
  function season(n) {
    return Array.from({ length: 6 }, (_, d) =>
      `<div class="day"><div class="number">${20 + d}</div><div class="month">09</div><div class="year">2026</div>`
      + Array.from({ length: n }, (_, i) =>
        `<tr><td class="title"><a href="https://www.tnb.ro/ro/p${i}"><h1>Prod ${i}</h1></a></td><td class="c2">Sala</td><td class="c3">${8 + (i % 12)}:00</td></tr>`).join('')
      + '</div>').join('')
  }

  const seasonVenue = { name: 'TNB', url: 'https://www.tnb.ro/x', adapter: 'tnb' }
  const serving = (body, onCall) => async (url) => {
    onCall?.()
    return { ok: true, status: 200, headers: new Headers(), text: async () => (url === seasonVenue.url ? season(61) : body) }
  }

  it('a blocked listing costs one request and stores nothing — the cache is empty, not broken', async () => {
    const store = memoryStore()
    let calls = 0
    const impl = async () => { calls++; return { ok: true, status: 200, headers: new Headers(), text: async () => CHALLENGE } }

    const r = await scanVenue(seasonVenue, { now: NOW, fetchImpl: impl, detailStore: store })

    expect(r.status).toBe(STATUS.THROTTLED)
    expect(r.detail).toMatch(/bot check/i)
    expect(calls).toBe(1)
    expect(store.data['marquee:details:v1:tnb']).toBeUndefined()
  })

  it('never reads more than the budget in one scan, however large the season', async () => {
    const store = memoryStore()
    let calls = 0
    await scanVenue(seasonVenue, { now: NOW, fetchImpl: serving(DETAIL, () => { calls++ }), detailStore: store })
    // One listing plus the budget — not one listing plus sixty-one.
    expect(calls).toBe(1 + DETAIL_BUDGET_PER_SCAN)
    expect(DETAIL_BUDGET_PER_SCAN).toBeLessThan(20)
  })

  it('fills a 61-production season over successive scans, then settles at one request', async () => {
    const store = memoryStore()
    const requestsPerScan = []
    for (let scan = 1; scan <= 7; scan++) {
      let calls = 0
      await scanVenue(seasonVenue, {
        now: new Date(NOW.getTime() + scan * 3600000),
        fetchImpl: serving(DETAIL, () => { calls++ }),
        detailStore: store,
      })
      requestsPerScan.push(calls)
    }
    // Five scans of 13, then the tail, then the listing alone. The peak is an
    // order of magnitude under the 62 that tripped the limiter.
    expect(requestsPerScan).toEqual([13, 13, 13, 13, 13, 2, 1])
    expect(Object.keys(store.data['marquee:details:v1:tnb'])).toHaveLength(61)
    expect(Math.max(...requestsPerScan)).toBeLessThan(20)
  })

  it('oldest first, so every production gets its turn instead of the same twelve', async () => {
    const store = memoryStore()
    const seen = []
    for (let scan = 1; scan <= 3; scan++) {
      await scanVenue(seasonVenue, {
        now: new Date(NOW.getTime() + scan * 3600000),
        fetchImpl: async (url) => {
          if (url !== seasonVenue.url) seen.push(url)
          return { ok: true, status: 200, headers: new Headers(), text: async () => (url === seasonVenue.url ? season(61) : DETAIL) }
        },
        detailStore: store,
      })
    }
    // Thirty-six distinct pages across three scans — no repeats, which is what
    // proves the queue advances rather than re-reading the head of the list.
    expect(new Set(seen).size).toBe(36)
  })

  it('carries the productions it did not get to on the records it already has', async () => {
    const store = memoryStore()
    await scanVenue(seasonVenue, { now: NOW, fetchImpl: serving(DETAIL), detailStore: store })
    const second = await scanVenue(seasonVenue, {
      now: new Date(NOW.getTime() + 3600000),
      fetchImpl: serving(DETAIL),
      detailStore: store,
    })
    // Twenty-four productions known after two scans; every one of their nights
    // keeps its poster rather than flickering out while the rest catch up.
    const withPoster = new Set(second.events.filter((e) => e.image).map((e) => e.link))
    expect(withPoster.size).toBe(24)
  })

  it('the budget never applies to an adapter whose extra pages ARE the programme', async () => {
    // eventbook's pagination and oveit's feed pages carry showings, not
    // posters. Skipping one there would silently drop a day, so the cap must
    // not reach them.
    expect(ADAPTERS.eventbook.extractDetail).toBeUndefined()
    expect(ADAPTERS.oveit.extractDetail).toBeUndefined()
    expect(ADAPTERS.iabilet.extractDetail).toBeUndefined()
  })
})

describe('a challenge page is not a detail page (§9.78)', () => {
  const CHALLENGE = `<html><title>Just a moment...</title><body>${'<p>One moment, please. Enable JavaScript and cookies to continue.</p>'.repeat(40)}</body></html>`

  it('is never stored as a record', async () => {
    const store = memoryStore()
    const fetcher = recordingFetch({
      detail: async () => ({ ok: true, status: 200, headers: new Headers(), text: async () => CHALLENGE }),
    })
    await scanVenue(VENUE, { now: NOW, fetchImpl: fetcher.impl, detailStore: store })
    expect(store.data[KEY]).toBeUndefined()
  })

  it('is never read as a production’s synopsis', async () => {
    // The visible half of the bug: "One moment, please. Enable JavaScript and
    // cookies to continue" was filed as the production's own description and
    // would have shown in the app — for a week, once cached, and for one scan
    // even before the cache existed.
    const fetcher = recordingFetch({
      detail: async () => ({ ok: true, status: 200, headers: new Headers(), text: async () => CHALLENGE }),
    })
    const r = await scanVenue(VENUE, { now: NOW, fetchImpl: fetcher.impl, detailStore: memoryStore() })
    expect(r.events.some((e) => /One moment|Enable JavaScript/i.test(e.description ?? ''))).toBe(false)
  })

  it('leaves the last good record in place, still due for a re-read', async () => {
    const longAgo = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const store = memoryStore({ [KEY]: { [PLACEBO]: record(PLACEBO, longAgo) } })
    const fetcher = recordingFetch({
      detail: async (url) => ({
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () => (url === PLACEBO ? CHALLENGE : DETAIL_BODY[url] ?? '<html></html>'),
      }),
    })

    const r = await scanVenue(VENUE, { now: NOW, fetchImpl: fetcher.impl, detailStore: store })

    expect(r.events.find((e) => e.link === PLACEBO).image).toBe('https://www.tnb.ro/remembered.jpg')
    expect(store.data[KEY][PLACEBO].fetchedAt).toBe(longAgo)
  })

  it('a real show called "Just a Moment" still keeps its own page', async () => {
    // The wording is generic on purpose, so the guard has to key on a page that
    // looks like a challenge overall, not on a title that happens to match.
    const realShow = `<html><img class="article-image" src="/jm.jpg"><p>${'Just a Moment is a new play about waiting, running ninety minutes without an interval. '.repeat(2)}</p></html>`
    const store = memoryStore()
    const fetcher = recordingFetch({
      detail: async () => ({ ok: true, status: 200, headers: new Headers(), text: async () => realShow }),
    })
    await scanVenue(VENUE, { now: NOW, fetchImpl: fetcher.impl, detailStore: store })
    expect(Object.keys(store.data[KEY] ?? {})).toHaveLength(3)
  })
})

describe('the scan says what it did with the cache (§9.79)', () => {
  const DETAIL = `<html><img class="article-image" src="/poster.jpg"><p>${'A real synopsis, long enough to count as prose. '.repeat(3)}</p></html>`

  function season(n) {
    return Array.from({ length: 6 }, (_, d) =>
      `<div class="day"><div class="number">${20 + d}</div><div class="month">09</div><div class="year">2026</div>`
      + Array.from({ length: n }, (_, i) =>
        `<tr><td class="title"><a href="https://www.tnb.ro/ro/p${i}"><h1>Prod ${i}</h1></a></td><td class="c2">Sala</td><td class="c3">${8 + (i % 12)}:00</td></tr>`).join('')
      + '</div>').join('')
  }
  const bigVenue = { name: 'TNB', url: 'https://www.tnb.ro/x', adapter: 'tnb' }
  const servingSeason = async (url) => ({
    ok: true, status: 200, headers: new Headers(),
    text: async () => (url === bigVenue.url ? season(20) : DETAIL),
  })

  it('reports a cold cache as all read, with the rest waiting on the budget', async () => {
    const store = memoryStore()
    const r = await scanVenue(bigVenue, { now: NOW, fetchImpl: servingSeason, detailStore: store })
    // Twenty productions, twelve of budget: none remembered, twelve read, eight
    // queued. The third number is what tells a filling cache apart from a
    // broken one.
    expect(r.cache).toEqual({ fromCache: 0, fetched: 12, queued: 8 })
  })

  it('reports a warm cache as all remembered, nothing read', async () => {
    const store = memoryStore()
    for (let i = 1; i <= 3; i++) {
      await scanVenue(bigVenue, { now: new Date(NOW.getTime() + i * 3600000), fetchImpl: servingSeason, detailStore: store })
    }
    const r = await scanVenue(bigVenue, { now: new Date(NOW.getTime() + 4 * 3600000), fetchImpl: servingSeason, detailStore: store })
    expect(r.cache).toEqual({ fromCache: 20, fetched: 0, queued: 0 })
  })

  it('counts a 304 as read, because a request went out', async () => {
    const longAgo = new Date(NOW.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const store = memoryStore({ [KEY]: { [PLACEBO]: record(PLACEBO, longAgo) } })
    const fetcher = recordingFetch({
      detail: async (url) => (url === PLACEBO
        ? { ok: false, status: 304, headers: new Headers() }
        : { ok: true, status: 200, headers: new Headers(), text: async () => DETAIL_BODY[url] ?? '<html></html>' }),
    })
    const r = await scanVenue(VENUE, { now: NOW, fetchImpl: fetcher.impl, detailStore: store })
    // Three productions, all three requested — the 304 among them. Nothing was
    // answered without asking, so nothing is "remembered", even though the
    // 304's content came from the store.
    expect(r.cache).toEqual({ fromCache: 0, fetched: 3, queued: 0 })
  })

  it('says nothing at all for a venue whose reader caches nothing', async () => {
    // eventbook follows pagination, which is programme rather than detail. A
    // "0 remembered, 0 read" there would be a meaningless line in the UI.
    const venue = { name: 'Cinema', url: 'https://eventbook.ro/hall/x', adapter: 'eventbook', config: 'x' }
    const r = await scanVenue(venue, {
      now: NOW,
      fetchImpl: async () => ({ ok: true, status: 200, headers: new Headers(), text: async () => '<html></html>' }),
      detailStore: memoryStore(),
    })
    expect(r.cache ?? null).toBeNull()
  })

  it('says nothing for a venue the check could not read at all', async () => {
    const CHALLENGE = `<html><title>Just a moment...</title><body>${'<p>One moment, please. Enable JavaScript and cookies to continue.</p>'.repeat(40)}</body></html>`
    const r = await scanVenue(bigVenue, {
      now: NOW,
      fetchImpl: async () => ({ ok: true, status: 200, headers: new Headers(), text: async () => CHALLENGE }),
      detailStore: memoryStore(),
    })
    expect(r.status).toBe(STATUS.THROTTLED)
    // Not `{0,0,0}` — the scan never reached the detail hop, and "we read
    // nothing" would read as a fact about the cache rather than about the wall.
    expect(r.cache ?? null).toBeNull()
  })
})

describe('the cache never holds anything that can go stale under you (§9.80)', () => {
  // The question this answers: does reading from cache put a sold-out night, a
  // withdrawn ticket link or a seat count at risk of being yesterday's?
  //
  // The structural answer is detailCache.js's rule 2, and the boundary test
  // above already asserts no record carries such a key. These are the dynamic
  // half: a state that CHANGED between two checks must reach the app even when
  // the second check read every detail page from cache and made zero requests
  // for them. That property is the whole licence for caching at all, so it is
  // pinned per cached venue rather than argued once in prose.
  //
  // It holds for one reason worth stating plainly: the LISTING page is never
  // cached, never conditional and never skipped by the budget. Ticket state,
  // seats, dates and sold-out all live there, and it is re-read in full on
  // every single check. The cache only ever covers a production's own page —
  // poster, synopsis, price — which is what does not change hour to hour.

  const TNB_DETAIL = `<html><img class="article-image" src="/poster.jpg"><div class="price_box"><p>80 lei</p></div><p>${'A real synopsis for this production, long enough to count as prose. '.repeat(3)}</p></html>`

  /** The same TNB listing twice, differing only in the ticket button: a live
   *  `red_button` anchor, or the `gray-button` "Vândut" that means sold out. */
  const tnbListing = (soldOut) => Array.from({ length: 6 }, (_, d) =>
    `<div class="day"><div class="number">${20 + d}</div><div class="month">09</div><div class="year">2026</div>`
    + Array.from({ length: 3 }, (_, i) =>
      `<tr><td class="title"><a href="https://www.tnb.ro/ro/p${i}"><h1>Prod ${i}</h1></a></td><td class="c2">Sala</td><td class="c3">${18 + i}:00</td><td>`
      + (soldOut ? '<a class="gray-button">Vândut</a>' : '<a href="https://www.bilet.ro/x" class="red_button">Bilete</a>')
      + '</td></tr>').join('')
    + '</div>').join('')

  it('TNB: a show selling out is visible on a check that read zero detail pages', async () => {
    const venue = { name: 'TNB', url: 'https://www.tnb.ro/x', adapter: 'tnb' }
    const store = memoryStore()
    const serve = (soldOut) => async (url) => ({
      ok: true, status: 200, headers: new Headers(),
      text: async () => (url === venue.url ? tnbListing(soldOut) : TNB_DETAIL),
    })

    const onSale = await scanVenue(venue, { now: NOW, fetchImpl: serve(false), detailStore: store })
    expect(onSale.events[0].ticketState).toBe('open')
    expect(onSale.events[0].ticketsUrl).toBe('https://www.bilet.ro/x')

    let detailCalls = 0
    const soldOut = await scanVenue(venue, {
      now: new Date(NOW.getTime() + 3600000),
      fetchImpl: async (url) => {
        if (url !== venue.url) detailCalls++
        return { ok: true, status: 200, headers: new Headers(), text: async () => (url === venue.url ? tnbListing(true) : TNB_DETAIL) }
      },
      detailStore: store,
    })

    expect(detailCalls).toBe(0)                            // a fully warm cache
    expect(soldOut.cache).toEqual({ fromCache: 3, fetched: 0, queued: 0 })
    expect(soldOut.events[0].ticketState).toBe('sold-out') // ...and the news still arrived
    expect(soldOut.events[0].ticketsUrl).toBeNull()
    expect(soldOut.events[0].image).toBeTruthy()           // while the poster came from cache
  })

  it('Metropolis: a withdrawn ticket link is visible on a check that read zero detail pages', async () => {
    const venue = { name: 'Metropolis', url: 'https://teatrulmetropolis.ro/program/', adapter: 'metropolis' }
    const detail = '<html><span class="show-pret">Preț bilet: 59,40 lei</span></html>'
    const programme = (soldOut) => Array.from({ length: 8 }, (_, i) =>
      `<span class="cal-date">${20 + i}.09</span><div class="cboxtitle"><a href="https://teatrulmetropolis.ro/p${i % 3}">Prod ${i % 3}</a></div>`
      + '<div class="mboxdesc"><span class="shrt">blurb</span></div><div class="cboxdet"><span class="show-sala">Sala Mare</span><span class="show-ora">19:00</span>'
      + `<span class="show-reval">${soldOut ? '' : '<a href="https://bilete.x/y">Cumpără bilete</a>'}</span></div>`).join('')
    const store = memoryStore()
    const serve = (soldOut) => async (url) => ({
      ok: true, status: 200, headers: new Headers(),
      text: async () => (url === venue.url ? programme(soldOut) : detail),
    })

    const onSale = await scanVenue(venue, { now: NOW, fetchImpl: serve(false), detailStore: store })
    expect(onSale.events[0].ticketState).toBe('open')
    expect(onSale.events[0].price).toBe(59.4)

    let detailCalls = 0
    const gone = await scanVenue(venue, {
      now: new Date(NOW.getTime() + 3600000),
      fetchImpl: async (url) => {
        if (url !== venue.url) detailCalls++
        return { ok: true, status: 200, headers: new Headers(), text: async () => (url === venue.url ? programme(true) : detail) }
      },
      detailStore: store,
    })

    expect(detailCalls).toBe(0)
    expect(gone.events[0].ticketState).toBe('none')
    expect(gone.events[0].price).toBe(59.4) // the price is what the cache is for
  })

  it('the listing page is never cached, never conditional, never skipped', async () => {
    // The invariant everything above rests on. If the programme page itself
    // were ever answered from a record, or allowed a 304, or dropped by the
    // budget, every guarantee in this block would evaporate at once.
    const venue = { name: 'TNB', url: 'https://www.tnb.ro/x', adapter: 'tnb' }
    const store = memoryStore()
    const calls = []
    const impl = async (url, init) => {
      calls.push({ url, headers: init?.headers ?? {} })
      return { ok: true, status: 200, headers: new Headers(), text: async () => (url === venue.url ? tnbListing(false) : TNB_DETAIL) }
    }

    await scanVenue(venue, { now: NOW, fetchImpl: impl, detailStore: store })
    calls.length = 0
    await scanVenue(venue, { now: new Date(NOW.getTime() + 3600000), fetchImpl: impl, detailStore: store })

    // Warm cache: the listing is the ONLY request, and it goes out unconditional.
    expect(calls.map((c) => c.url)).toEqual([venue.url])
    expect(calls[0].headers['if-none-match']).toBeUndefined()
    expect(calls[0].headers['if-modified-since']).toBeUndefined()
    // And it is never itself written to the store.
    expect(Object.keys(store.data[KEY])).not.toContain(venue.url)
  })

  it('seat counts belong to a reader that caches nothing, so they cannot be stale', () => {
    // Excelsior's remaining-seat numbers (§9.68) and Oveit's seats.io charts
    // (§9.71) are the most volatile things Marquee reads. Both come from
    // adapters that store nothing at all, so every count in the app was fetched
    // during the check that displayed it.
    expect(ADAPTERS.excelsior.extractDetail).toBeUndefined()
    expect(ADAPTERS.oveit.extractDetail).toBeUndefined()
    // Excelsior's is the load-bearing case: its enrich() mines the detail pages
    // for the ids it posts seat lookups against, so those pages have to be in
    // hand — which is exactly why it was excluded from caching in §9.76.
    expect(typeof ADAPTERS.excelsior.enrich).toBe('function')
  })

  it('no cached record for any venue contains a showing-level fact', () => {
    // The static guarantee, restated against every cached adapter at once so a
    // fourteenth venue cannot quietly widen what gets stored.
    const volatile = ['ticketState', 'ticketsUrl', 'seatsLeft', 'seatsTotal', 'date', 'time', 'isAvailable', 'soldOut']
    const probe = {
      url: 'x',
      body: `<html><img class="article-image" src="/p.jpg"><div class="price_box"><p>80 lei</p></div><span class="show-pret">59,40 lei</span><div class="content"><p>${'Prose long enough to be kept as a description here. '.repeat(3)}</p></div></html>`,
    }
    for (const [id, adapter] of Object.entries(ADAPTERS)) {
      if (typeof adapter.extractDetail !== 'function') continue
      const keys = Object.keys(adapter.extractDetail(probe))
      expect({ id, offending: keys.filter((k) => volatile.includes(k)) }).toEqual({ id, offending: [] })
    }
  })
})
