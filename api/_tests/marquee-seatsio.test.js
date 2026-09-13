// Seat counts for Oveit's seated events (§9.71), against real seats.io
// responses captured from Filarmonica's own ticketing on 2026-09-12:
// Ateneul Român's small hall (78 seats, `seatsio-chart-sala-mica.b64`), the
// statuses feed for the 13 October concert in it, and that event's
// rendering-info. The two binary fixtures are the wire bytes, base64'd — the
// byte shift IS what `decode` exists for, so storing them decoded would test
// nothing.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import oveit from '../_lib/marquee/oveit.js'
import { decode, seatLabel, seatsOf, countFree, renderingInfoUrl, statusesUrl, chartUrl } from '../_lib/marquee/seatsio.js'

const here = dirname(fileURLToPath(import.meta.url))
const fixture = (name) => readFileSync(join(here, '../_lib/marquee/__fixtures__', name), 'utf8')
const bytes = (name) => new Uint8Array(Buffer.from(fixture(name).replace(/\s+/g, ''), 'base64'))

const CHART = decode(bytes('seatsio-chart-sala-mica.b64'))
const STATUSES = decode(bytes('seatsio-statuses-e702.b64'))
const RENDERING = JSON.parse(fixture('seatsio-rendering-e702.json'))
const LISTING = JSON.parse(fixture('oveit-seated.json'))
const venue = { name: 'Filarmonica George Enescu', adapter: 'oveit', url: 'https://oveit.com/hub/org/l7PDAr7y', config: 'l7PDAr7y' }
// Both fixture rows are in October 2026; a scan "now" inside the seat horizon.
const NOW = new Date('2026-09-20T09:00:00Z')

/** The wire form: every byte raised by one constant, as seats.io serves it. */
const shift = (obj, by) => new Uint8Array([...new TextEncoder().encode(JSON.stringify(obj))].map((b) => (b + by) % 256))

describe('seats.io responses', () => {
  it('reads the byte shift off the payload instead of hardcoding it', () => {
    // Filarmonica's own responses come back shifted by 29 today. Nothing
    // announces that constant, so it is recovered from the first byte — a
    // change of constant then costs nothing, where a hardcoded 29 would
    // silently stop decoding.
    expect(decode(shift([{ a: 1 }], 29))).toEqual([{ a: 1 }])
    expect(decode(shift([{ a: 1 }], 7))).toEqual([{ a: 1 }])
    expect(decode(shift({ a: 1 }, 0))).toEqual({ a: 1 })
  })

  it('returns null for anything it cannot decode, rather than throwing', () => {
    expect(decode(new Uint8Array([1, 2, 3]))).toBeNull()
    expect(decode(new Uint8Array())).toBeNull()
    expect(decode(null)).toBeNull()
  })

  it('decodes the captured hall and statuses', () => {
    // 90 seats drawn, of which 78 are in the two categories this concert sells
    // — the gap is what `countFree`'s category filter exists for.
    expect(seatsOf(CHART).size).toBe(90)
    expect(STATUSES.every((row) => row.eventKey === 'E702')).toBe(true)
  })

  it('joins a seat label the way the statuses feed spells it', () => {
    // The big hall labels no rows (they arrive as `?`) so its seats are
    // `Centru-43`; the small hall does, so its are `Sala mică-4-26`. Getting
    // this wrong matches nothing, and a hall where nothing matches reads as a
    // hall where nothing is taken.
    expect(seatLabel('Centru', '?', '43')).toBe('Centru-43')
    expect(seatLabel('Sala mică', '4', '26')).toBe('Sala mică-4-26')
    expect(seatLabel(null, null, '7')).toBe('7')
    const labels = [...seatsOf(CHART).keys()]
    for (const row of STATUSES) expect(labels).toContain(row.objectLabelOrUuid)
  })
})

describe('countFree', () => {
  const buyable = new Set(['C101', 'C102'])

  it('counts the live small hall: 78 seats on sale, all of them free', () => {
    // The captured statuses are two seats that were taken and released — the
    // feed reports the release, so both count as free again. A whole hall still
    // available is exactly what a small-hall recital five weeks out looks like.
    expect(STATUSES.every((row) => row.status === 'free')).toBe(true)
    expect(countFree(CHART, STATUSES, { categoryKeys: buyable })).toEqual({ total: 78, free: 78 })
  })

  it('leaves out categories no ticket type sells', () => {
    // Protocol seats are the house's own. Counting them would report a sold-out
    // concert as half empty — the 29 September recital put 192 of a 794-seat
    // hall on sale.
    const all = countFree(CHART, STATUSES, { categoryKeys: new Set(['C101', 'C102', 'C103', 'C172']) })
    expect(all.total).toBeGreaterThan(78)
    expect(countFree(CHART, STATUSES, { categoryKeys: new Set(['C103']) }).free).toBeGreaterThan(0)
  })

  it('honours a withheld-seat blacklist and a for-sale whitelist', () => {
    const [first, second] = [...seatsOf(CHART).entries()].filter(([, cat]) => buyable.has(cat)).map(([label]) => label)
    const blacklisted = countFree(CHART, [], { categoryKeys: buyable, forSale: false, forSaleObjects: [first, second] })
    expect(blacklisted).toEqual({ total: 76, free: 76 })
    const whitelisted = countFree(CHART, [], { categoryKeys: buyable, forSale: true, forSaleObjects: [first, second] })
    expect(whitelisted).toEqual({ total: 2, free: 2 })
  })

  it('counts a released seat as free again and a held one as gone', () => {
    const label = [...seatsOf(CHART).entries()].find(([, cat]) => cat === 'C101')[0]
    const free = countFree(CHART, [{ objectLabelOrUuid: label, status: 'free' }], { categoryKeys: buyable })
    const held = countFree(CHART, [{ objectLabelOrUuid: label, status: 'reservedByToken' }], { categoryKeys: buyable })
    expect(free.free).toBe(78)
    expect(held.free).toBe(77)
  })

  it('voids the whole count when a status label is not in the hall', () => {
    // The dangerous direction: labels that don't line up match no taken seats
    // and would report a full house. One stranger is enough to refuse to answer.
    const strangers = [...STATUSES, { objectLabelOrUuid: 'Balcon-9-9', status: 'booked' }]
    expect(countFree(CHART, strangers, { categoryKeys: buyable })).toBeNull()
  })

  it('answers null, not zero, when there is nothing to count', () => {
    expect(countFree(CHART, STATUSES, { categoryKeys: new Set() })).toBeNull()
    expect(countFree({}, STATUSES, { categoryKeys: buyable })).toBeNull()
    expect(countFree(CHART, STATUSES, { categoryKeys: new Set(['C999']) })).toBeNull()
  })
})

describe('oveit’s seat-count hop', () => {
  const listingPage = { json: LISTING }
  const W = 'b0df5d8a-f686-4341-9e57-b74e9a7bd856'

  const renderingPage = (eventKey, over = {}) => ({
    ok: true, tag: { kind: 'seats-rendering', eventKey }, json: { ...RENDERING, ...over },
  })
  const statusPage = (eventKey, rows) => ({
    ok: true, tag: { kind: 'seats-status', eventKey }, bytes: shift(rows, 29),
  })
  const chartPage = () => ({
    ok: true, tag: { kind: 'seats-chart', chartKey: RENDERING.chartKey, version: RENDERING.drawingVersion }, bytes: bytes('seatsio-chart-sala-mica.b64'),
  })

  it('asks for each concert’s chart and statuses first', () => {
    const asked = oveit.enrich([listingPage], { venue, now: NOW })
    expect(asked.map((r) => r.url)).toEqual([
      renderingInfoUrl(W, 'E652'), statusesUrl(W, 'E652'),
      renderingInfoUrl(W, 'E702'), statusesUrl(W, 'E702'),
    ])
    // The statuses and the chart are bytes, not JSON — scan.js must not decode
    // them as text on the way in.
    expect(asked.filter((r) => r.binary)).toHaveLength(2)
  })

  it('asks for the hall itself only once the first round named it', () => {
    // Two concerts, one hall: the drawing is fetched per chart and version, not
    // per concert. This is the reason `enrich` runs in rounds at all — the
    // chart key is only knowable from the previous answer.
    const pages = [listingPage, renderingPage('E652'), statusPage('E652', []), renderingPage('E702'), statusPage('E702', STATUSES)]
    const second = oveit.enrich(pages, { venue, now: NOW })
    expect(second).toHaveLength(1)
    expect(second[0].url).toBe(chartUrl(W, RENDERING.chartKey, RENDERING.drawingVersion))
    expect(oveit.enrich([...pages, chartPage()], { venue, now: NOW })).toEqual([])
  })

  it('does not look past the horizon or past the cap', () => {
    // The horizon matches the programme's own (120 days), so a concert in the
    // middle of a season never sits there with no number; what bounds the hop
    // in practice is the cap below.
    const far = new Date('2026-01-01T00:00:00Z')
    expect(oveit.enrich([listingPage], { venue, now: far })).toEqual([])
    const many = { json: { events: Array.from({ length: 40 }, (_, i) => ({
      ...LISTING.events[1], id: `e${i}`, seatingChart: { workspaceKey: W, event: `E${900 + i}` },
    })) } }
    // 24 concerts × two requests each — the same ceiling excelsior.js uses, and
    // for the same reason: this hop runs inside Wanderlist's evening cron.
    expect(oveit.enrich([many], { venue, now: NOW })).toHaveLength(48)
  })

  it('reports seats left, and only the counted concert changes', () => {
    // The recital is in the big hall, whose drawing is not among these pages —
    // so it keeps the state the feed gave it while its neighbour gets a count.
    // Nothing here spreads one concert's answer to another.
    const pages = [listingPage, renderingPage('E702'), statusPage('E702', STATUSES), chartPage()]
    const events = oveit.parse(pages, { venue })
    const recital = events.find((e) => e.date === '2026-09-29')
    const marti = events.find((e) => e.date === '2026-10-13')
    expect(marti.seatsLeft).toBe(78)
    expect(marti.ticketState).toBe('open')
    expect(recital.seatsLeft).toBeNull()
    expect(recital.ticketState).toBe('open')
  })

  it('says sold out when every buyable seat in the hall is gone', () => {
    const gone = [...seatsOf(CHART).entries()]
      .filter(([, cat]) => ['C101', 'C102'].includes(cat))
      .map(([label]) => ({ objectLabelOrUuid: label, status: 'booked' }))
    const pages = [listingPage, renderingPage('E702'), statusPage('E702', gone), chartPage()]
    const marti = oveit.parse(pages, { venue }).find((e) => e.date === '2026-10-13')
    expect(marti.ticketState).toBe('sold-out')
    // A sold-out showing is already fully described by its state.
    expect(marti.seatsLeft).toBeNull()
  })

  it('says last seats when a handful are left — what the chip is for', () => {
    const seats = [...seatsOf(CHART).entries()].filter(([, cat]) => ['C101', 'C102'].includes(cat)).map(([label]) => label)
    const gone = seats.slice(0, seats.length - 3).map((label) => ({ objectLabelOrUuid: label, status: 'booked' }))
    const pages = [listingPage, renderingPage('E702'), statusPage('E702', gone), chartPage()]
    const marti = oveit.parse(pages, { venue }).find((e) => e.date === '2026-10-13')
    expect(marti.ticketState).toBe('open')
    expect(marti.seatsLeft).toBe(3)
  })

  it('leaves a showing exactly as it was when the count cannot be completed', () => {
    // No chart page: the chain stops, and nothing about the showing changes.
    const pages = [listingPage, renderingPage('E702'), statusPage('E702', STATUSES)]
    const marti = oveit.parse(pages, { venue }).find((e) => e.date === '2026-10-13')
    expect(marti.seatsLeft).toBeNull()
    expect(marti.ticketState).toBe('open')
    // And with no seat pages at all — the state every non-seated Oveit vendor
    // stays in.
    const plain = oveit.parse([listingPage], { venue })
    expect(plain.every((e) => e.seatsLeft === null)).toBe(true)
    expect(plain.every((e) => e.ticketState !== 'sold-out')).toBe(true)
  })
})
