import { describe, it, expect } from 'vitest'
import { diff, toSnapshot, sortChanges, summarize, CHANGE } from './changes.js'
import { toProductions, byDate, visibleProductions, productionId, domIdFor, scanPayload, TRIAGE } from './programme.js'
import { normalizeVenue } from './venues.js'
import { formatDay, formatRun, formatPrice } from './format.js'

const NOW = new Date('2026-08-26T09:00:00')

const event = (over = {}) => ({
  key: 'excelsior:2026-09-23T20:00:tomcat',
  venue: 'Teatrul Excelsior',
  title: 'Tomcat',
  date: '2026-09-23',
  time: '20:00',
  ticketState: 'none',
  hall: null,
  link: null,
  image: null,
  price: null,
  ...over,
})

/** A scan snapshot, plus the venues that actually answered. */
const snap = (events, answered = ['Teatrul Excelsior']) => ({
  ...toSnapshot(events, '2026-08-26T09:00:00.000Z'),
  answeredVenues: answered,
})

describe('diff', () => {
  it('says nothing on a first scan — a baseline is not news', () => {
    // Every event is technically "new" here; reporting 200 of them tells you
    // nothing, so the first scan establishes the baseline silently.
    const result = diff(null, snap([event()]), { now: NOW })
    expect(result).toEqual({ hadSnapshot: false, changes: [] })
  })

  it('reports an event that was not there before', () => {
    const before = snap([event()])
    const after = snap([event(), event({ key: 'k2', title: 'Metamorfoza', date: '2026-09-24' })])
    const { changes } = diff(before, after, { now: NOW })
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({ kind: CHANGE.NEW, title: 'Metamorfoza' })
  })

  it('reports tickets going on sale — the change worth acting on', () => {
    const before = snap([event({ ticketState: 'none' })])
    const after = snap([event({ ticketState: 'open' })])
    const { changes } = diff(before, after, { now: NOW })
    expect(changes).toHaveLength(1)
    expect(changes[0].kind).toBe(CHANGE.TICKETS_OPENED)
  })

  it('reports a night selling out', () => {
    const { changes } = diff(snap([event({ ticketState: 'open' })]), snap([event({ ticketState: 'sold-out' })]), { now: NOW })
    expect(changes[0].kind).toBe(CHANGE.SOLD_OUT)
  })

  it('says nothing when nothing moved', () => {
    const before = snap([event({ ticketState: 'open' })])
    expect(diff(before, before, { now: NOW }).changes).toEqual([])
  })

  it('reports a future event that vanished from a venue that answered', () => {
    const { changes } = diff(snap([event()]), snap([]), { now: NOW })
    expect(changes).toHaveLength(1)
    expect(changes[0].kind).toBe(CHANGE.CANCELLED)
  })

  it('never calls an event cancelled when its venue did not answer', () => {
    // The failure this prevents: one throttled venue empties the app, every event
    // is reported cancelled, and the next scan reports them all as brand new.
    const { changes } = diff(snap([event()]), snap([], []), { now: NOW })
    expect(changes).toEqual([])
  })

  it('does not call a past event cancelled — it simply happened', () => {
    const past = event({ key: 'past', date: '2026-08-01' })
    const { changes } = diff(snap([past]), snap([]), { now: NOW })
    expect(changes).toEqual([])
  })

  it('reports a re-listed event as new again rather than staying silent', () => {
    const before = snap([])
    const after = snap([event()])
    expect(diff(before, after, { now: NOW }).changes[0].kind).toBe(CHANGE.NEW)
  })

  it('orders what you can act on above what you can only know', () => {
    const changes = sortChanges([
      { kind: CHANGE.NEW, date: '2026-09-01' },
      { kind: CHANGE.SOLD_OUT, date: '2026-09-01' },
      { kind: CHANGE.TICKETS_OPENED, date: '2026-09-05' },
      { kind: CHANGE.CANCELLED, date: '2026-09-02' },
    ])
    expect(changes.map((c) => c.kind)).toEqual([
      CHANGE.TICKETS_OPENED, CHANGE.CANCELLED, CHANGE.SOLD_OUT, CHANGE.NEW,
    ])
  })
})

describe('summarize', () => {
  it('counts events and sold-out nights', () => {
    expect(summarize({ status: 'ok', events: [event({ ticketState: 'sold-out' }), event({ key: 'b' })] }))
      .toBe('2 events · 1 sold out')
    expect(summarize({ status: 'empty', events: [] })).toBe('nothing upcoming')
  })

  it('passes a failure’s own words through rather than a count', () => {
    expect(summarize({ status: 'parser-broken', detail: 'Markup changed.', events: [] })).toBe('Markup changed.')
  })
})

describe('productions', () => {
  const events = [
    event({ key: 'a', title: 'Metamorfoza', date: '2026-09-24', time: '19:00', ticketState: 'open' }),
    event({ key: 'b', title: 'Metamorfoza', date: '2026-09-26', time: '15:00', ticketState: 'sold-out' }),
    event({ key: 'c', title: 'Tomcat', date: '2026-09-23', time: '17:00', ticketState: 'sold-out' }),
    event({ key: 'd', title: 'Tomcat', date: '2026-09-23', time: '20:00', ticketState: 'open' }),
  ]
  const productions = toProductions(events)

  it('collapses a run into one card with its dates nested', () => {
    expect(productions).toHaveLength(2)
    expect(productions.map((p) => p.title)).toEqual(['Tomcat', 'Metamorfoza'])
    expect(productions[0].showings).toHaveLength(2)
  })

  it('orders productions by their soonest showing, and showings within by time', () => {
    expect(productions[0].firstDate).toBe('2026-09-23')
    expect(productions[0].showings.map((s) => s.time)).toEqual(['17:00', '20:00'])
  })

  it('treats a run as buyable when any night is, and sold out only when all are', () => {
    // "Sold out" on a card must mean the run is gone, not that one night is —
    // otherwise a production with tickets left looks unavailable.
    expect(productions[0].anyOpen).toBe(true)
    expect(productions[0].allSoldOut).toBe(false)
    const allGone = toProductions([events[2], { ...events[3], ticketState: 'sold-out' }])
    expect(allGone[0].allSoldOut).toBe(true)
  })

  it('keeps the same title at different venues apart', () => {
    const two = toProductions([event({ key: 'x' }), event({ key: 'y', venue: 'Club Control' })])
    expect(two).toHaveLength(2)
    expect(productionId(event())).not.toBe(productionId(event({ venue: 'Club Control' })))
  })

  it('groups into days for the feed', () => {
    const days = byDate(productions)
    expect(days.map((d) => d.date)).toEqual(['2026-09-23', '2026-09-24'])
  })

  it('hides an ignored production, including its future dates', () => {
    const triage = { [productions[0].id]: TRIAGE.IGNORED }
    expect(visibleProductions(productions, { triage }).map((p) => p.title)).toEqual(['Metamorfoza'])
  })

  it('filters to one venue', () => {
    const mixed = toProductions([event({ key: 'x' }), event({ key: 'y', venue: 'Club Control', title: 'Gig' })])
    expect(visibleProductions(mixed, { venue: 'Club Control' }).map((p) => p.title)).toEqual(['Gig'])
  })
})

describe('formatting', () => {
  it('names the near days rather than dating them', () => {
    expect(formatDay('2026-08-26', { now: NOW })).toBe('Tonight')
    expect(formatDay('2026-08-27', { now: NOW })).toBe('Tomorrow')
    expect(formatDay('2026-08-29', { now: NOW })).toBe('Saturday')
    expect(formatDay('2026-09-23', { now: NOW })).toMatch(/23 Sep/)
  })

  it('speaks backwards about the last scan', () => {
    expect(formatDay('2026-08-25', { now: NOW, relative: true })).toBe('yesterday')
    expect(formatDay('2026-08-26', { now: NOW, relative: true })).toBe('earlier today')
    expect(formatDay('2026-08-01', { now: NOW, relative: true })).toBe('on 1 Aug')
  })

  it('describes a run by its shape', () => {
    const [tomcat, meta] = toProductions([
      event({ key: 'c', title: 'Tomcat', date: '2026-09-23', time: '17:00' }),
      event({ key: 'a', title: 'Metamorfoza', date: '2026-09-24' }),
      event({ key: 'b', title: 'Metamorfoza', date: '2026-09-26' }),
    ])
    expect(formatRun(tomcat)).toMatch(/17:00/)
    expect(formatRun(meta)).toMatch(/^2 dates ·/)
  })

  it('says Free rather than 0 lei, and nothing at all for an unknown price', () => {
    expect(formatPrice(0)).toBe('Free')
    expect(formatPrice(50)).toBe('50 lei')
    expect(formatPrice(null)).toBeNull()
  })
})

describe('domIdFor', () => {
  it('turns a production id into a valid, stable DOM id', () => {
    const id = domIdFor(productionId({ venue: 'Teatrul Excelsior', title: 'Marile speranțe' }))
    expect(id).toBe('prod-teatrul-excelsior-marile-sperante')
    expect(id).toMatch(/^[a-z0-9-]+$/)
  })

  it('gives the same id from a "What changed" row as from the card it points at', () => {
    // This is the whole contract: a change carries only venue+title, and that has
    // to fold to exactly the id toProductions() put on the real card.
    const [production] = toProductions([event({ venue: 'Teatrul Excelsior', title: 'Tomcat' })])
    const fromChange = domIdFor(productionId({ venue: 'Teatrul Excelsior', title: 'Tomcat' }))
    expect(domIdFor(production.id)).toBe(fromChange)
  })

  it('never collapses to an id two different productions could share', () => {
    expect(domIdFor(productionId({ venue: 'Club Control', title: 'Gig' })))
      .not.toBe(domIdFor(productionId({ venue: 'Club Control', title: 'Gig 2' })))
  })
})

describe('scanPayload', () => {
  it('carries category, so the endpoint can pick a per-category horizon', () => {
    const venues = [normalizeVenue({ id: '1', name: 'Cinema Union', url: 'https://eventbook.ro/hall/cinema-union', adapter: 'eventbook', category: 'movie' })]
    expect(scanPayload(venues)[0]).toMatchObject({ category: 'movie' })
  })

  it('drops a paused or unsupported venue, same as before', () => {
    const venues = [
      normalizeVenue({ id: '1', name: 'Paused', url: 'https://x.ro', adapter: 'jsonld', status: 'paused' }),
      normalizeVenue({ id: '2', name: 'No reader', url: 'https://x.ro', adapter: 'unsupported' }),
    ]
    expect(scanPayload(venues)).toEqual([])
  })
})
