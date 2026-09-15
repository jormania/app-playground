// The detail-page cache — the answer to TNB serving a bot check (2026-09-15).
//
// The thing under test is a NEGATIVE: the request that is no longer made. So
// most of these assert on what the fake fetch was asked for, not on what came
// back. The venue used throughout is TNB, the only adapter that opts in today
// (by declaring `extractDetail`) and the one whose 61-requests-per-scan poster
// hop is what tripped the bot check in the first place.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import tnb from '../_lib/marquee/tnb.js'
import { scanVenue, STATUS } from '../_lib/marquee/scan.js'
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
