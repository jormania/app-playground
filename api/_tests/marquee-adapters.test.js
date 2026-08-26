// The adapters, against markup actually served by the four sites on 2026-08-26
// (api/_lib/marquee/__fixtures__/). Trimmed to a handful of rows each, but not
// edited — every quirk asserted below is one the real page has.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import excelsior from '../_lib/marquee/excelsior.js'
import eventbook from '../_lib/marquee/eventbook.js'
import filarmonica from '../_lib/marquee/filarmonica.js'
import jsonld from '../_lib/marquee/jsonld.js'
import { inferYear, slug, eventKey, parseTime, decodeEntities, dedupe } from '../_lib/marquee/shared.js'
import { assess, scanVenue, STATUS } from '../_lib/marquee/scan.js'

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '../_lib/marquee/__fixtures__')
const fixture = (name) => readFileSync(join(FIXTURES, name), 'utf8')

const AUG = new Date('2026-08-26T09:00:00Z')

describe('shared helpers', () => {
  describe('inferYear — the piece most likely to be quietly wrong', () => {
    it('reads a month still ahead as this year', () => {
      expect(inferYear('27', 'Aug', AUG)).toBe('2026-08-27')
      expect(inferYear('1', 'Oct', AUG)).toBe('2026-10-01')
    })

    it('rolls a month already past into next year', () => {
      // A programme read in December that lists "10 Ian" means January, not a
      // January eleven months gone.
      expect(inferYear('10', 'Ian', new Date('2026-12-15T09:00:00Z'))).toBe('2027-01-10')
    })

    it('keeps a just-passed date inside the current month rather than jumping a year', () => {
      // Listings routinely still show yesterday's show. Reading that as next year
      // would put a phantom event 12 months out and fake a "new event" every scan.
      expect(inferYear('24', 'Aug', AUG)).toBe('2026-08-24')
    })

    it('understands Romanian month names that differ from English', () => {
      expect(inferYear('3', 'Noi', AUG)).toBe('2026-11-03')
      expect(inferYear('3', 'Mai', AUG)).toBe('2027-05-03')
      expect(inferYear('3', 'Iun', AUG)).toBe('2027-06-03')
    })

    it('returns null for nonsense instead of a plausible wrong date', () => {
      expect(inferYear('40', 'Aug', AUG)).toBeNull()
      expect(inferYear('3', 'Smarch', AUG)).toBeNull()
      expect(inferYear(null, null, AUG)).toBeNull()
    })
  })

  it('slug folds diacritics so a title tweak cannot fake a new event', () => {
    expect(slug('Marile speranțe')).toBe('marile-sperante')
    expect(slug('Marile sperante')).toBe(slug('Marile speranțe'))
    expect(slug('Cinema Muzeul Țăranului')).toBe('cinema-muzeul-taranului')
  })

  it('eventKey is venue + date + title, and the time when there is one', () => {
    expect(eventKey('Teatrul Excelsior', '2026-09-05', 'Marile speranțe'))
      .toBe('teatrul-excelsior:2026-09-05:marile-sperante')
    expect(eventKey('Teatrul Excelsior', '2026-09-23', 'Tomcat', '20:00'))
      .toBe('teatrul-excelsior:2026-09-23T20:00:tomcat')
    // Two showings on one day are two events, not one.
    expect(eventKey('X', '2026-09-23', 'T', '17:00')).not.toBe(eventKey('X', '2026-09-23', 'T', '20:00'))
  })

  it('decodes the numeric entities eventbook emits for every diacritic', () => {
    expect(decodeEntities('Dou&#259;zeci &#537;i')).toBe('Douăzeci și')
  })

  it('parseTime rejects impossible clock values rather than passing them on', () => {
    expect(parseTime('la ora 19:00')).toBe('19:00')
    expect(parseTime('99:99')).toBeNull()
    expect(parseTime('35 lei')).toBeNull()
  })

  it('dedupe keeps the first of a repeated key', () => {
    const a = { key: 'x', title: 'first' }
    expect(dedupe([a, { key: 'x', title: 'second' }, { key: 'y' }])).toEqual([a, { key: 'y' }])
  })
})

describe('Teatrul Excelsior', () => {
  const venue = { name: 'Teatrul Excelsior', url: 'https://teatrul-excelsior.ro/program/', adapter: 'excelsior' }
  const events = excelsior.parse([{ body: fixture('excelsior.html') }], { venue, now: AUG })

  it('reads every agenda row', () => {
    expect(events).toHaveLength(6)
  })

  it('reads a showing whole', () => {
    expect(events[0]).toMatchObject({
      venue: 'Teatrul Excelsior',
      title: 'Tomcat',
      date: '2026-09-23',
      time: '17:00',
      ticketState: 'sold-out',
    })
    expect(events[0].link).toMatch(/^https:\/\/teatrul-excelsior\.ro\/spectacol\//)
  })

  it('reads both ticket states off the markup, without inferring either', () => {
    expect(events.map((e) => e.ticketState)).toEqual([
      'sold-out', 'open', 'open', 'open', 'open', 'open',
    ])
  })

  it('keeps two showings of one production on one day apart, with their own ticket states', () => {
    // Tomcat plays twice on 23 Sep: 17:00 is sold out, 20:00 is on sale. Keying on
    // venue+date+title alone collapsed these into one row that reported SOLD OUT
    // for both — the app lying about a show you could still get into.
    const tomcat = events.filter((e) => e.title === 'Tomcat')
    expect(tomcat).toHaveLength(2)
    expect(tomcat.map((e) => e.date)).toEqual(['2026-09-23', '2026-09-23'])
    expect(tomcat.map((e) => e.time)).toEqual(['17:00', '20:00'])
    expect(tomcat.map((e) => e.ticketState)).toEqual(['sold-out', 'open'])
    expect(new Set(tomcat.map((e) => e.key)).size).toBe(2)
    expect(dedupe(tomcat)).toHaveLength(2)
  })

  it('gives one production across several dates one key each', () => {
    const meta = events.filter((e) => e.title === 'Metamorfoza')
    expect(meta.map((e) => e.date)).toEqual(['2026-09-24', '2026-09-25', '2026-09-26', '2026-09-26'])
    expect(new Set(meta.map((e) => e.key)).size).toBe(4)
  })
})

describe('eventbook', () => {
  const venue = {
    name: 'Cinema Elvira Popescu',
    url: 'https://eventbook.ro/hall/cinema-elvire-popesco',
    adapter: 'eventbook',
    config: 'cinema-elvire-popesco',
  }
  const pages = [{ body: fixture('eventbook.html') }]
  const events = eventbook.parse(pages, { venue })

  it('skips the ticket-carnet rows, which are listed like showings but have no date', () => {
    // Five blocks in the fixture; the first two are carnets.
    expect(events).toHaveLength(3)
    expect(events.every((e) => !/carnet/i.test(e.title))).toBe(true)
  })

  it('reads a showing whole, with the year and time the site actually prints', () => {
    expect(events[0]).toMatchObject({
      venue: 'Cinema Elvira Popescu',
      date: '2026-08-26',
      time: '18:00',
      ticketState: 'open',
    })
    expect(events[0].link).toMatch(/^https:\/\/eventbook\.ro\/film\//)
    expect(events[0].title.length).toBeGreaterThan(2)
  })

  it('discovers its own pagination from page 1', () => {
    const more = eventbook.follow(pages, { venue })
    expect(more.length).toBeGreaterThan(0)
    expect(more[0].url).toBe('https://eventbook.ro/hall/cinema-elvire-popesco?page=2')
    expect(more.every((r) => !/page=1\b/.test(r.url))).toBe(true)
  })

  it('reads a time for every showing', () => {
    // The time is bare text after the icon span, behind ~40 spaces of template
    // indentation. A length-capped match ran out before reaching it and every
    // showing silently lost its time — which no other assertion would notice.
    expect(events.every((e) => /^\d{2}:\d{2}$/.test(e.time))).toBe(true)
  })

  it('does not re-list a showing that appears on two pages', () => {
    const twice = eventbook.parse([...pages, ...pages], { venue })
    expect(dedupe(twice)).toHaveLength(3)
  })
})

describe('Filarmonica (Strapi feed)', () => {
  const venue = { name: 'Filarmonica George Enescu', adapter: 'filarmonica', url: 'https://www.filarmonicaenescu.ro/ro/evenimente' }
  const events = filarmonica.parse([{ json: JSON.parse(fixture('filarmonica.json')) }], { venue })

  it('maps the feed rows', () => {
    expect(events).toHaveLength(3)
    expect(events[0]).toMatchObject({
      venue: 'Filarmonica George Enescu',
      title: 'Recital cameral',
      date: '2026-09-29',
      hall: 'Ateneul Român · Sala Mare',
    })
  })

  it('reads Bucharest wall time, not the stored UTC hour', () => {
    // The feed stores 16:00Z for a concert the venue prints as 19:00.
    expect(events[0].time).toBe('19:00')
  })

  it('trusts the feed’s own button state, not the presence of a ticket URL', () => {
    // Rows labelled "Cumpără bilete" routinely carry no ticketUrl — reading the URL
    // as the signal reported concerts with tickets on sale as having none.
    expect(events[0].ticketState).toBe('sold-out') // buyLabel "Sold Out" + disableBuy
    expect(events[1].ticketState).toBe('open')     // buyLabel set, ticketUrl absent
    expect(events[1].ticketsUrl).toBeNull()
  })

  it('asks the feed for events that have not ended yet, soonest first', () => {
    const [req] = filarmonica.requests(venue, { now: AUG })
    expect(req.json).toBe(true)
    expect(decodeURIComponent(req.url)).toContain('endDateAndTime][$gte]=2026-08-26')
    expect(decodeURIComponent(req.url)).toContain('sort[0]=startDateAndTime:asc')
  })
})

describe('generic schema.org reader (Expirat)', () => {
  const venue = { name: 'Expirat Halele Carol', adapter: 'expirat', url: 'https://tickets.expirat.org/' }
  const events = jsonld.parse([{ body: fixture('expirat.html') }], { venue })

  it('reads the Event blocks, CDATA wrapper and all', () => {
    expect(events).toHaveLength(3)
    expect(events[0]).toMatchObject({
      venue: 'Expirat Halele Carol',
      title: 'Ana Coman • Hidden Gems',
      date: '2026-08-26',
      ticketState: 'open',
      price: 50,
    })
    expect(events[0].ticketsUrl).toMatch(/^https:\/\//)
  })

  it('drops a hall that merely repeats the venue name', () => {
    // Expirat's JSON-LD names its location "Expirat Halele Carol" — the venue
    // itself — which rendered as "Expirat Halele Carol · Expirat Halele Carol".
    expect(events.every((e) => e.hall === null)).toBe(true)
  })

  it('finds nothing on a page with no Event objects, rather than inventing structure', () => {
    const page = { body: '<script type="application/ld+json">{"@type":"WebPage","name":"Program"}</script>' }
    expect(jsonld.parse([page], { venue })).toEqual([])
  })

  it('survives a malformed block instead of losing the whole page', () => {
    const broken = { body: '<script type="application/ld+json">{ not json </script>' + fixture('expirat.html') }
    expect(jsonld.parse([broken], { venue })).toHaveLength(3)
  })
})

describe('the health gate', () => {
  const adapter = { minItems: 4 }
  const pages = [{ body: 'x'.repeat(5000) }]
  const good = [{ date: '2026-09-01' }, { date: '2026-09-02' }, { date: '2026-09-03' }, { date: '2026-09-04' }]

  it('passes a healthy scan', () => {
    expect(assess(adapter, pages, good).status).toBe(STATUS.OK)
  })

  it('calls a page that parsed to nothing broken, never empty', () => {
    // The whole point: silence must be loud.
    expect(assess(adapter, pages, []).status).toBe(STATUS.PARSER_BROKEN)
  })

  it('catches a partial parse against the venue’s declared floor', () => {
    expect(assess(adapter, pages, good.slice(0, 2)).status).toBe(STATUS.PARSER_BROKEN)
  })

  it('catches a date-format change, which nothing else would notice', () => {
    const undated = good.map((e) => ({ ...e, date: null }))
    expect(assess(adapter, pages, undated).detail).toMatch(/date format/i)
  })

  it('catches a placeholder body served with a 200', () => {
    expect(assess(adapter, [{ body: 'nope' }], good).status).toBe(STATUS.PARSER_BROKEN)
  })
})

describe('scanVenue', () => {
  const venue = { id: 'v1', name: 'Teatrul Excelsior', url: 'https://teatrul-excelsior.ro/program/', adapter: 'excelsior' }
  const ok = (body) => async () => ({ ok: true, status: 200, text: async () => body, json: async () => ({}) })

  it('returns upcoming events for a healthy venue', async () => {
    const r = await scanVenue(venue, { now: AUG, fetchImpl: ok(fixture('excelsior.html')) })
    expect(r.status).toBe(STATUS.OK)
    expect(r.events.length).toBe(6)
    expect(r.checkedAt).toBe('2026-08-26')
  })

  it('separates "nothing on" from "parser broken"', async () => {
    // Everything falls outside the horizon, so the parse was healthy and there is
    // simply nothing to show. This must never read as a broken reader — that is
    // the distinction the whole health gate exists to preserve.
    const r = await scanVenue(venue, { now: AUG, horizonDays: 0, fetchImpl: ok(fixture('excelsior.html')) })
    expect(r.status).toBe(STATUS.EMPTY)
    expect(r.detail).toMatch(/nothing upcoming/i)
    expect(r.events).toEqual([])
  })

  it('reports a redesigned page as broken, with a detail a human can act on', async () => {
    const r = await scanVenue(venue, { now: AUG, fetchImpl: ok('<div>' + 'x'.repeat(4000) + '</div>') })
    expect(r.status).toBe(STATUS.PARSER_BROKEN)
    expect(r.detail).toMatch(/markup/i)
  })

  it('separates a rate limiter from a broken parser', async () => {
    const feed = { id: 'v2', name: 'Filarmonica George Enescu', url: 'https://www.filarmonicaenescu.ro/ro/evenimente', adapter: 'filarmonica' }
    const r = await scanVenue(feed, { now: AUG, fetchImpl: async () => ({ ok: false, status: 403 }) })
    expect(r.status).toBe(STATUS.THROTTLED)
    expect(r.detail).toMatch(/rate-limiting/i)
  })

  it('reports an unreachable page as unreachable', async () => {
    const r = await scanVenue(venue, { now: AUG, fetchImpl: async () => { throw new Error('ENOTFOUND') } })
    expect(r.status).toBe(STATUS.UNREACHABLE)
  })

  it('never throws when a reader does — one bad venue cannot take down a scan', async () => {
    const bad = { ...venue, adapter: 'nope' }
    const r = await scanVenue(bad, { now: AUG, fetchImpl: ok('') })
    expect(r.status).toBe(STATUS.UNSUPPORTED)
    expect(r.events).toEqual([])
  })
})
