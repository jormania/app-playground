// ARCUB, against markup actually served by arcub.ro/agenda on 2026-08-29
// (api/_lib/marquee/__fixtures__/arcub.html) — trimmed to the live page's own
// 7 current listings, not edited.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import arcub, { datesFromMeta } from '../_lib/marquee/arcub.js'

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '../_lib/marquee/__fixtures__')
const fixture = (name) => readFileSync(join(FIXTURES, name), 'utf8')

// The fixture was captured Saturday 2026-08-29 — a date inside the live
// "3 aprilie - 30 august" exhibition range, which is exactly the case this
// adapter has to get right (§ datesFromMeta below).
const TODAY = new Date('2026-08-29T09:00:00Z')

describe('datesFromMeta', () => {
  it('reads a single day', () => {
    expect(datesFromMeta('9 septembrie', TODAY)).toEqual(['2026-09-09'])
  })

  it('enumerates a short same-month range as one showing per day', () => {
    // A guided-tour series named across a handful of days — the multi-showing
    // production model this becomes reads as "pick a day", not "opens then".
    expect(datesFromMeta('26 - 29 august', TODAY)).toEqual([
      '2026-08-26', '2026-08-27', '2026-08-28', '2026-08-29',
    ])
  })

  it('enumerates a short cross-month range the same way', () => {
    expect(datesFromMeta('30 august - 2 septembrie', TODAY)).toEqual([
      '2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02',
    ])
  })

  it('collapses a long range to a single opening-day showing', () => {
    // The real live case: an exhibition running 3 April to 30 August is
    // already well underway on the day this was scanned. Enumerating it would
    // be ~150 rows for one exhibition; a long run instead shows once.
    expect(datesFromMeta('3 aprilie - 30 august', TODAY)).toEqual(['2026-04-03'])
  })

  it('does not roll a long range’s PAST start month into next year', () => {
    // The bug this guards: naively running inferYear on "3 aprilie" alone,
    // independent of the range's end, reads April as behind August and rolls
    // it a full year forward (2027) — wrong, since the exhibition is
    // genuinely already running this year. The end of the range (close to
    // `now`) is what should anchor the year, and the start shares it.
    const [start] = datesFromMeta('3 aprilie - 30 august', TODAY)
    expect(start.slice(0, 4)).toBe('2026')
  })

  it('rolls a range spanning New Year one year earlier on the start', () => {
    const dec = new Date('2026-12-20T09:00:00Z')
    expect(datesFromMeta('28 decembrie - 3 ianuarie', dec)).toEqual([
      '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03',
    ])
  })

  it('returns nothing for text in none of the three observed shapes', () => {
    expect(datesFromMeta('curând', TODAY)).toEqual([])
    expect(datesFromMeta('', TODAY)).toEqual([])
  })
})

describe('ARCUB', () => {
  const venue = { name: 'ARCUB', url: 'https://arcub.ro/agenda', adapter: 'arcub' }
  const events = arcub.parse([{ body: fixture('arcub.html') }], { venue, now: TODAY })

  it('reads every current listing', () => {
    // 7 cards; the two "26 - 29 august" / "29 - 30 august" short ranges each
    // enumerate into several showings, so the event count exceeds the card count.
    const distinctLinks = new Set(events.map((e) => e.link))
    expect(distinctLinks.size).toBe(7)
  })

  it('reads a single-day showing whole', () => {
    const show = events.find((e) => e.title === 'Cineva are să vină')
    expect(show).toMatchObject({
      venue: 'ARCUB',
      date: '2026-09-09',
      hall: 'Sala Mare',
      ticketState: 'open',
    })
    expect(show.ticketsUrl).toMatch(/^https:\/\/www\.iabilet\.ro\//)
    expect(show.image).toMatch(/^https:\/\/arcub\.ro\/img\//)
  })

  it('reads the per-event category off ARCUB’s own tag, not one guess for the whole venue', () => {
    const byTitle = Object.fromEntries(events.map((e) => [e.title, e.category]))
    expect(byTitle['Cineva are să vină']).toBe('play')
    expect(byTitle['Teodora Brody: „Întâlniri cu Oameni-Păsări – esențe de zbor”']).toBe('concert')
    expect(byTitle['Expoziție: Lia și Dan Perjovschi. DRAFT pentru o retrospectivă comună']).toBe('art')
    // "Festival" -> event, ARCUB's own catch-all for a city-wide happening.
    expect(byTitle['Program artistic • Străzi deschise • Weekend #18']).toBe('event')
  })

  it('keeps ARCUB as the venue even for a street event at a public location', () => {
    const streetEvent = events.find((e) => e.title === 'Program artistic • Străzi deschise • Weekend #18')
    expect(streetEvent.venue).toBe('ARCUB')
    expect(streetEvent.hall).toBe('Calea Victoriei')
  })

  it('strips the venue name from an in-house hall but keeps a public location whole', () => {
    const inHouse = events.find((e) => e.title === 'Cineva are să vină')
    expect(inHouse.hall).toBe('Sala Mare')
    const publicSpace = events.find((e) => e.title === 'iMapp Bucharest 2026 revine în Piața Constituției')
    expect(publicSpace.hall).toBe('Piața Constituției')
  })

  it('reads ticket state from whether a buy button exists at all, not a fixed label', () => {
    // Both no-ticket cards are short 2-day ranges, so each enumerates into two
    // showings — the titles repeat, the underlying cards don't.
    const noTickets = events.filter((e) => e.ticketState === 'none')
    expect(new Set(noTickets.map((e) => e.title))).toEqual(new Set([
      'Program artistic • Străzi deschise • Weekend #18',
      'iMapp Bucharest 2026 revine în Piața Constituției',
    ]))
    expect(events.every((e) => e.ticketState === 'none' || e.ticketState === 'open')).toBe(true)
  })

  it('enumerates the short guided-tour range into one showing per day, same production', () => {
    const tour = events.filter((e) => e.title === 'Tur ghidat cu Dan Perjovschi | 26 - 29 august | ora 18:30')
    expect(tour.map((e) => e.date)).toEqual(['2026-08-26', '2026-08-27', '2026-08-28', '2026-08-29'])
    expect(new Set(tour.map((e) => e.key)).size).toBe(4)
  })

  it('collapses the long exhibition range to its opening day, not 150 rows', () => {
    const expo = events.filter((e) => e.title.startsWith('Expoziție: Lia și Dan Perjovschi'))
    expect(expo).toHaveLength(1)
    expect(expo[0].date).toBe('2026-04-03')
  })

  it('does not bleed one card’s fields into an adjacent card', () => {
    // The two Perjovschi guided-tour listings share a poster URL pattern but
    // are genuinely different cards; a window big enough to reach the next
    // item's <object class="box-cta"> would misattribute a ticket link.
    const noon = events.find((e) => e.title === 'Tur ghidat cu Dan Perjovschi | ora 15:00 & 17:00')
    expect(noon.date).toBe('2026-08-30')
    expect(noon.ticketsUrl).toMatch(/entertix/)
  })

  it('asks for one detail page per distinct production, for its description', () => {
    const follow = arcub.follow([{ body: fixture('arcub.html') }])
    expect(follow.map((r) => r.url)).toContain('https://arcub.ro/eveniment/cineva-are-sa-vina-384')
    // 7 cards, but the two Perjovschi tour listings share the same detail link
    // as the exhibition itself (all three point at one entertix ticket), so
    // distinct hrefs can be fewer than distinct titles — never more than 7.
    expect(follow.length).toBeLessThanOrEqual(7)
  })

  describe('description — the one field the listing itself does not carry', () => {
    const withDetail = arcub.parse(
      [{ body: fixture('arcub.html') }, { url: 'https://arcub.ro/eveniment/cineva-are-sa-vina-384', body: fixture('arcub-detail-cineva-are-sa-vina.html') }],
      { venue, now: TODAY },
    )

    it('reads the synopsis off the production’s own detail page', () => {
      const show = withDetail.find((e) => e.title === 'Cineva are să vină')
      expect(show.description).toMatch(/Jon Fosse/)
    })

    it('leaves description null for a production whose detail page was not fetched', () => {
      const other = withDetail.find((e) => e.title === 'Teodora Brody: „Întâlniri cu Oameni-Păsări – esențe de zbor”')
      expect(other.description).toBeNull()
    })
  })

  it('reports parser-broken rather than a wrong reading on a genuinely empty body', () => {
    expect(arcub.parse([{ body: '' }], { venue, now: TODAY })).toEqual([])
  })
})
