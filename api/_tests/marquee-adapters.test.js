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
import oveit, { vendorFromUrl } from '../_lib/marquee/oveit.js'
import iabilet from '../_lib/marquee/iabilet.js'
import tnb from '../_lib/marquee/tnb.js'
import mystage from '../_lib/marquee/mystage.js'
import { inferYear, slug, eventKey, parseTime, decodeEntities, dedupe, makeEvent, proseParagraphs } from '../_lib/marquee/shared.js'
import { assess, scanVenue, horizonFor, HORIZON_DAYS, MOVIE_HORIZON_DAYS, STATUS } from '../_lib/marquee/scan.js'

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

  describe('proseParagraphs — skip past the boilerplate, not a synopsis parser', () => {
    it('takes the first real paragraphs, skipping short label lines', () => {
      const html = '<p>7 lei</p><p>A real synopsis paragraph, long enough to actually be a sentence about the show.</p>'
      expect(proseParagraphs(html)).toBe('A real synopsis paragraph, long enough to actually be a sentence about the show.')
    })

    it('stops at `max`, even when a later paragraph would also qualify', () => {
      const html = '<p>First real paragraph, easily past the length floor this filter uses.</p>'
        + '<p>Second real paragraph, also easily past the length floor this filter uses.</p>'
        + '<p>Third real paragraph, which should never be reached because max defaults to two.</p>'
      const result = proseParagraphs(html)
      expect(result).toContain('First real paragraph')
      expect(result).toContain('Second real paragraph')
      expect(result).not.toContain('Third real paragraph')
    })

    it('returns null rather than an empty string when nothing qualifies', () => {
      expect(proseParagraphs('<p>7 lei</p><p>90 lei</p>')).toBeNull()
      expect(proseParagraphs('')).toBeNull()
    })
  })

  it('makeEvent clips an overlong description at a word boundary, never mid-word', () => {
    const long = 'word '.repeat(200).trim()
    const event = makeEvent({ venue: 'V', title: 'T', date: '2026-09-01', description: long })
    expect(event.description.length).toBeLessThanOrEqual(501) // 500 + the ellipsis char
    expect(event.description.endsWith('…')).toBe(true)
    expect(event.description.endsWith(' …')).toBe(false) // no stray space before it
    const short = makeEvent({ venue: 'V', title: 'T', date: '2026-09-01', description: 'A short one.' })
    expect(short.description).toBe('A short one.')
    const none = makeEvent({ venue: 'V', title: 'T', date: '2026-09-01' })
    expect(none.description).toBeNull()
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

  it('asks for one detail page per DISTINCT production, not per showing', () => {
    // Tomcat and Metamorfoza between them are 6 rows in the fixture but only 2
    // distinct links — a run's dates all share one detail page.
    const follow = excelsior.follow([{ body: fixture('excelsior.html') }])
    expect(follow.map((r) => r.url).sort()).toEqual([
      'https://teatrul-excelsior.ro/spectacol/metamorfoza/',
      'https://teatrul-excelsior.ro/spectacol/tomcat/',
    ])
  })

  describe('posters — the listing has none; only a production’s own detail page does', () => {
    const detailPages = [
      { body: fixture('excelsior-detail-tomcat.html') },
      { body: fixture('excelsior-detail-metamorfoza.html') },
    ]

    it('attaches each production’s own poster, matched by the detail page’s own canonical URL', () => {
      const withPosters = excelsior.parse([{ body: fixture('excelsior.html') }, ...detailPages], { venue, now: AUG })
      const tomcat = withPosters.filter((e) => e.title === 'Tomcat')
      const meta = withPosters.filter((e) => e.title === 'Metamorfoza')
      expect(tomcat.every((e) => e.image === 'https://teatrul-excelsior.ro/wp-content/uploads/2025/04/TOMCAT-vizual-1-scaled-e1746876802831.jpg')).toBe(true)
      expect(meta.every((e) => e.image === 'https://teatrul-excelsior.ro/wp-content/uploads/2025/10/A9100136-1-scaled.jpg')).toBe(true)
    })

    it('is unaffected by the order detail pages come back in', () => {
      const reversed = excelsior.parse([{ body: fixture('excelsior.html') }, ...[...detailPages].reverse()], { venue, now: AUG })
      const tomcat = reversed.find((e) => e.title === 'Tomcat')
      expect(tomcat.image).toContain('TOMCAT-vizual')
    })

    it('leaves a production posterless when its detail page never came back, rather than crashing', () => {
      const onlyOne = excelsior.parse([{ body: fixture('excelsior.html') }, detailPages[0]], { venue, now: AUG })
      const meta = onlyOne.find((e) => e.title === 'Metamorfoza')
      expect(meta.image).toBeNull()
    })

    it('treats a show with no featured image set as a real answer, not a failure', () => {
      // Yoast only emits og:image when a featured image exists; some shows on
      // this very site genuinely don't have one set.
      const withNoCover = excelsior.parse(
        [{ body: fixture('excelsior.html') }, { body: fixture('excelsior-detail-no-cover.html') }],
        { venue, now: AUG },
      )
      expect(withNoCover.every((e) => e.image === null)).toBe(true)
    })

    it('reads the real synopsis off the same detail page it already fetches for the poster', () => {
      const withDetails = excelsior.parse([{ body: fixture('excelsior.html') }, ...detailPages], { venue, now: AUG })
      const tomcat = withDetails.find((e) => e.title === 'Tomcat')
      expect(tomcat.description).toContain('Jess')
      expect(tomcat.description).not.toContain('premieră pe țară') // too short to qualify, correctly skipped
    })
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

  it('reads the poster off eventbook’s own CDN — it was there all along, just never extracted', () => {
    expect(events[0].image).toMatch(/^https:\/\/storage\.googleapis\.com\/.*\.webp$/)
    expect(events.every((e) => e.image)).toBe(true)
  })

  it('reads the price off the same block — it was there too, just never extracted', () => {
    expect(events.every((e) => e.price === 27)).toBe(true)
  })

  it('takes the leading number and ignores a trailing tariff name', () => {
    // "27 lei (Bilet Întreg)" — seen on the live site, not (yet) in this fixture.
    const withTariffName = eventbook.parse([{
      body: '<div id="performance">'
        + '<a href="/film/x" class="text-dark event-title d-block text-uppercase text-decoration-none">'
        + '<h5>Test Film</h5></a>'
        + '<span class="msym">calendar_month</span> 26 Aug 2026'
        + '<span class="msym">schedule</span> 18:00'
        + '<span class="text-muted">price:</span> 27 lei (Bilet Întreg)'
        + '<a href="/x" class="add_in_cart"></a>'
        + '</div>',
    }], { venue })
    expect(withTariffName[0].price).toBe(27)
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

  it('flattens the feed’s block-editor description into plain text', () => {
    // Strapi's rich-text format nests text runs inside blocks inside an array —
    // real programme content (soloists, pieces), just not a plain string.
    expect(events[0].description).toContain('Martha Argerich')
    expect(events[0].description).toContain('pian')
  })

  it('asks the feed for events that have not ended yet, soonest first', () => {
    const [req] = filarmonica.requests(venue, { now: AUG })
    expect(req.json).toBe(true)
    expect(decodeURIComponent(req.url)).toContain('endDateAndTime][$gte]=2026-08-26')
    expect(decodeURIComponent(req.url)).toContain('sort[0]=startDateAndTime:asc')
  })
})

describe('Oveit (the ticketing platform, as a source)', () => {
  const venue = {
    name: 'Filarmonica George Enescu',
    adapter: 'oveit',
    url: 'https://oveit.com/hub/org/l7PDAr7y',
    config: 'l7PDAr7y',
  }
  const pages = [{ json: JSON.parse(fixture('oveit.json')) }]
  const events = oveit.parse(pages, { venue })

  it('reads the vendor id out of a hub URL', () => {
    expect(vendorFromUrl('https://oveit.com/hub/org/l7PDAr7y')).toBe('l7PDAr7y')
    expect(vendorFromUrl('https://oveit.com/hub/event/QzvN4wzk')).toBeNull()
    expect(vendorFromUrl('not a url')).toBeNull()
  })

  it('maps the feed rows', () => {
    expect(events).toHaveLength(3)
    expect(events[0]).toMatchObject({
      venue: 'Filarmonica George Enescu',
      title: 'Recital cameral',
      date: '2026-09-29',
      ticketState: 'open',
      price: 150,
    })
    expect(events[0].hall).toMatch(/Ateneul/)
    expect(events[0].ticketsUrl).toBe('https://oveit.com/hub/event/QzvN4wzk')
  })

  it('reads the venue’s own wall clock, not the stored UTC hour', () => {
    // 16:00Z is the 19:00 printed on the ticket.
    expect(events[0].time).toBe('19:00')
  })

  it('never claims sold out — the feed has no such flag', () => {
    // Absent price means "no price published", not "gone". Inventing a sold-out
    // state from silence is exactly the false precision this app refuses.
    const noPrice = oveit.parse([{ json: { events: [{
      id: 'x', name: 'Concert', timeInterval: { startsAt: '2026-10-01T16:00:00.000000Z' },
      minmaxticketsprices: { minPrice: 0, maxPrice: 0 },
    }] } }], { venue })
    expect(noPrice[0].ticketState).toBe('none')
    expect(noPrice[0].price).toBeNull()
    expect(events.some((e) => e.ticketState === 'sold-out')).toBe(false)
  })

  it('pages until the feed says nothing is left', () => {
    // Page size is read from the page in hand rather than assumed. This fixture
    // is trimmed to 3 rows (the live page carries 8), so 4 remaining reads as two
    // more pages instead of one. That is the safe direction to be wrong in: an
    // extra request returns an empty page, whereas under-counting would silently
    // drop the tail of a season.
    const more = oveit.follow(pages, { venue })
    expect(more.map((r) => r.url)).toEqual([2, 3].map((n) =>
      `https://membership-api.oveit.com/v1/vendor/l7PDAr7y/events?page=${n}&include=type,timeInterval,dateTimeFormat,location,cover,currency,minmaxticketsprices`))

    expect(oveit.follow([{ json: { events: [], remainingEvents: 0 } }], { venue })).toEqual([])
  })

  it('stops at a page cap rather than looping if remainingEvents never falls', () => {
    const runaway = oveit.follow([{ json: { events: [{}], remainingEvents: 9999 } }], { venue })
    expect(runaway.length).toBeLessThanOrEqual(7)
  })

  it('asks for nothing when the URL names no vendor', () => {
    expect(oveit.requests({ ...venue, config: null, url: 'https://oveit.com/hub' })).toEqual([])
  })
})

describe('iabilet (a venue page that fans out into weekly bundles — Cinema Europa)', () => {
  const venue = {
    name: 'Cinema Europa',
    adapter: 'iabilet',
    url: 'https://www.iabilet.ro/bilete-cinema-europa-venue-5877/',
    config: '5877',
  }
  const venuePage = { body: fixture('iabilet-venue.html') }
  const bundlePage = { body: fixture('iabilet-bundle.html') }

  it('finds the child bundle links on the venue page — the venue page itself lists nothing', () => {
    // The venue page is a JS shell to a server fetch: it names five weekend
    // bundles and not one individual showing.
    expect(iabilet.parse([venuePage], { venue })).toEqual([])
    const bundles = iabilet.follow([venuePage], { venue })
    expect(bundles.length).toBe(5)
    expect(bundles[0].url).toBe('https://www.iabilet.ro/bilete-asian-spotlight-vol-2-130105/')
  })

  it('reads the showings out of one bundle page, dropping the weekend pass', () => {
    const events = iabilet.parse([bundlePage], { venue })
    // 4 showings in the fixture (Chungking Express, Parasite, Memories of
    // Murder, In the Mood for Love) each sold at two price tiers that must
    // collapse into ONE event — never the two Abonament (subscription) rows,
    // which have no date or time of their own and are not a showing.
    expect(events).toHaveLength(4)
    expect(events.every((e) => !/abonament/i.test(e.title))).toBe(true)
  })

  it('reads a showing whole, at the cheapest still-open price', () => {
    const [chungking] = iabilet.parse([bundlePage], { venue })
    expect(chungking).toMatchObject({
      venue: 'Cinema Europa',
      title: 'Chungking Express',
      date: '2026-08-28',
      time: '18:15',
      ticketState: 'open',
      price: 20, // the discounted tariff, not the 30-lei full price
    })
    expect(chungking.link).toBe('https://www.iabilet.ro/bilete-asian-spotlight-vol-2-130105/')
  })

  it('survives the one malformed tariff string in the fixture', () => {
    // "In the Mood for Love - Bilet preț redus)elevi, studenti, pemsionari)" —
    // a stray parenthesis right after "redus" that must not spill into the
    // title, which the em-dash/"Bilet" split boundary never even looks at.
    const events = iabilet.parse([bundlePage], { venue })
    expect(events.some((e) => e.title === 'In the Mood for Love')).toBe(true)
  })

  it('calls a showing sold out only once every one of its price tiers is', () => {
    // The two Abonament rows are dropped as not-a-showing, but their OWN sold-out
    // state ("Stoc epuizat") must never leak onto a real film's tariff group —
    // there is no shared key between them.
    const events = iabilet.parse([bundlePage], { venue })
    expect(events.every((e) => e.ticketState === 'open')).toBe(true)
  })

  it('reads the bundle’s own year-bearing date, not "today", for its day-and-month rows', () => {
    // The tariff text carries no year ("28 august"); the bundle's own JSON-LD
    // startDate is what anchors it, so a bundle spanning a year boundary reads
    // correctly regardless of when the scan happens to run.
    const events = iabilet.parse([bundlePage], { venue })
    expect(events.every((e) => e.date.startsWith('2026-08'))).toBe(true)
  })
})

describe('tnb (one venue, 7 halls sharing it)', () => {
  const venue = { name: 'Teatrul Național București', url: 'https://www.tnb.ro/ro/bilete-online', adapter: 'tnb' }
  const listing = { url: venue.url, body: fixture('tnb.html') }
  const events = tnb.parse([listing], { venue })

  it('reads every hall off one page — 9 showings across 4 halls in the fixture', () => {
    expect(events).toHaveLength(9)
    const halls = new Set(events.map((e) => e.hall))
    expect(halls).toEqual(new Set(['Amfiteatru', 'Sala Atelier', 'Sala Pictura', 'Sala "Ion Caramitru"', 'Sala Studio']))
  })

  it('reads the numeric day/month/year triplet, not a month name', () => {
    expect(events[0]).toMatchObject({ venue: 'Teatrul Național București', date: '2026-08-26', time: '20:30' })
  })

  it('reads ticket state from the button, not from any implied default', () => {
    // Both states are real markup on this page, not inferred.
    const placebo = events.find((e) => e.title === '(D)efectul Placebo')
    const luizaZan = events.find((e) => e.title === 'Concert Luiza Zan & Muse Quartet')
    expect(placebo.ticketState).toBe('open')
    expect(placebo.ticketsUrl).toBe('https://www.bilet.ro/eveniment/defectul-placebo-18709-64050')
    expect(luizaZan.ticketState).toBe('sold-out')
    expect(luizaZan.ticketsUrl).toBeNull()
  })

  it('fixes TNB’s own percent-mis-encoded ticket href rather than reproducing the 404', () => {
    // The fixture's first row emits `href="https%3A%2F%2Fwww.bilet.ro%2F..."` verbatim
    // — a bug on TNB's own site. A literal href like that 404s if left alone.
    const placebo = events.find((e) => e.title === '(D)efectul Placebo')
    expect(placebo.ticketsUrl).toMatch(/^https:\/\/www\.bilet\.ro\//)
  })

  it('treats the same title twice in one day, same hall, different times, as two showings', () => {
    const copilarie = events.filter((e) => e.title === 'Amintiri din copilărie')
    expect(copilarie).toHaveLength(2)
    expect(copilarie.map((e) => e.time).sort()).toEqual(['11:00', '19:00'])
  })

  describe('posters — one hop per distinct production, matched by request URL', () => {
    const placeboPage = { url: 'https://www.tnb.ro/ro/defectul-placebo-2026', body: fixture('tnb-detail-placebo.html') }
    const luizaPage = { url: 'https://www.tnb.ro/ro/concert-luiza-zan-muse-quartet', body: fixture('tnb-detail-luiza-zan.html') }

    it('discovers one detail request per distinct production link, not per showing', () => {
      const requests = tnb.follow([listing])
      expect(requests).toHaveLength(7) // 9 showings, 2 of them repeat an already-seen title
      expect(requests.map((r) => r.url)).toContain('https://www.tnb.ro/ro/amintiri-din-copilarie')
    })

    it('attaches each production’s own poster', () => {
      const withPosters = tnb.parse([listing, placeboPage, luizaPage], { venue })
      expect(withPosters.find((e) => e.title === '(D)efectul Placebo').image)
        .toBe('https://www.tnb.ro/uploads/articles/2943/2686/small_large_Afis_placebo_2022-Nou13.jpg')
      expect(withPosters.find((e) => e.title === 'Concert Luiza Zan & Muse Quartet').image)
        .toBe('https://www.tnb.ro/uploads/articles/2938/2682/small_Luiza_Zan.jpg')
    })

    it('is unaffected by the order detail pages come back in', () => {
      const reversed = tnb.parse([listing, luizaPage, placeboPage], { venue })
      expect(reversed.find((e) => e.title === '(D)efectul Placebo').image).toContain('Afis_placebo')
    })

    it('leaves a production posterless when its detail page never came back', () => {
      const onlyOne = tnb.parse([listing, placeboPage], { venue })
      expect(onlyOne.find((e) => e.title === 'Concert Luiza Zan & Muse Quartet').image).toBeNull()
    })

    it('leaves a production posterless when its own page genuinely has no cover', () => {
      const noCover = tnb.parse([listing, { url: 'https://www.tnb.ro/ro/defectul-placebo-2026', body: fixture('tnb-detail-no-cover.html') }], { venue })
      expect(noCover.find((e) => e.title === '(D)efectul Placebo').image).toBeNull()
    })

    it('reads the synopsis off the same detail page, past the content-advisory paragraph TNB prints first', () => {
      const withDetails = tnb.parse([listing, placeboPage, luizaPage], { venue })
      const placebo = withDetails.find((e) => e.title === '(D)efectul Placebo')
      expect(placebo.description).toContain('nerecomandat minorilor') // the advisory, kept
      expect(placebo.description).toContain('spectacol viu') // the real synopsis, also kept
    })
  })
})

describe('mystage (Teatrul Unteatru today — any mystage.ro venue the same way)', () => {
  const venue = { name: 'Teatrul Unteatru', url: 'https://www.mystage.ro/locatii/teatrul-unteatru-321', adapter: 'mystage' }
  const events = mystage.parse([{ body: fixture('mystage-unteatru.html') }], { venue })

  it('reads the events straight out of the embedded __NEXT_DATA__ JSON, no HTML parsing', () => {
    expect(events).toHaveLength(3)
    expect(events[0]).toMatchObject({
      venue: 'Teatrul Unteatru',
      title: 'Masacrul',
      date: '2026-08-27',
      time: '19:00',
      hall: null,
      ticketState: 'open',
    })
  })

  it('names a real hall when there is one, and treats mystage’s own "-" placeholder as none', () => {
    const mass = events.find((e) => e.title === 'MASS')
    expect(mass.hall).toBe('Sala Mare')
    expect(events.find((e) => e.title === 'Masacrul').hall).toBeNull()
  })

  it('reads the poster straight from the JSON — no follow() hop needed at all', () => {
    expect(events[0].image).toMatch(/^https:\/\/mystage-static/)
  })

  it('reads the description straight from the JSON too — already plain prose, nothing to extract', () => {
    expect(events[0].description).toContain('Două cupluri')
    // MASS's fixture entry carries no description field at all.
    expect(events.find((e) => e.title === 'MASS').description).toBeNull()
  })

  it('trusts mystage’s own isAvailable flag for ticket state', () => {
    expect(events.find((e) => e.title === 'Constructed Sold Out Example').ticketState).toBe('sold-out')
  })

  it('never reports a price of 0 as a real price', () => {
    // mystage's own primary-occurrence price is routinely 0 before a date goes on
    // sale — reporting that as "free" would be false precision, not a real answer.
    expect(events.find((e) => e.title === 'Masacrul').price).toBeNull()
    expect(events.find((e) => e.title === 'MASS').price).toBe(110.08)
  })

  it('builds a working link from the numeric event id even without mystage’s own slug', () => {
    // mystage's routing only keys on the trailing id — any slug text before it is
    // decorative, so a slug built here works even if it doesn't byte-match theirs.
    expect(events[0].link).toBe('https://www.mystage.ro/spectacole/masacrul-3385')
  })

  it('returns nothing rather than throwing when the page carries no __NEXT_DATA__ at all', () => {
    expect(mystage.parse([{ body: '<html><body>no data here</body></html>' }], { venue })).toEqual([])
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

  it('reads the description straight off the JSON-LD `description` property', () => {
    expect(events[0].description).toBeTruthy()
    expect(events[0].description.length).toBeGreaterThan(10)
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

describe('horizonFor', () => {
  it('gives a cinema a short horizon and everything else the long one', () => {
    // Cinemas list weeks of showings nobody plans a trip around this far out —
    // a blanket rule on the category, not a per-venue setting to remember.
    expect(horizonFor({ category: 'movie' })).toBe(MOVIE_HORIZON_DAYS)
    expect(horizonFor({ category: 'concert' })).toBe(HORIZON_DAYS)
    expect(horizonFor({ category: 'play' })).toBe(HORIZON_DAYS)
    expect(horizonFor({})).toBe(HORIZON_DAYS)
    expect(horizonFor(undefined)).toBe(HORIZON_DAYS)
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
