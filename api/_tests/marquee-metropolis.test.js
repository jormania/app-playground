// Teatrul Metropolis, against markup actually served by
// teatrulmetropolis.ro/program/ on 2026-09-01
// (api/_lib/marquee/__fixtures__/metropolis-program.html) — trimmed to five of
// the live page's own showings, not edited.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import metropolis, { parseDetailPrice } from '../_lib/marquee/metropolis.js'

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '../_lib/marquee/__fixtures__')
const fixture = (name) => readFileSync(join(FIXTURES, name), 'utf8')

const venue = {
  name: 'Teatrul Metropolis',
  adapter: 'metropolis',
  url: 'https://teatrulmetropolis.ro/program/',
}
const page = { body: fixture('metropolis-program.html') }
const NOW = new Date('2026-09-01T09:00:00Z')

describe('metropolis (the theatre’s own WordPress /program/ page, not its ticketing SPA)', () => {
  it('reads every showing in the fixture', () => {
    const events = metropolis.parse([page], { venue, now: NOW })
    expect(events).toHaveLength(5)
  })

  it('reads a sold-out showing whole, hall and time included', () => {
    const events = metropolis.parse([page], { venue, now: NOW })
    const club27 = events.find((e) => e.title === 'Club 27')
    expect(club27).toMatchObject({
      venue: 'Teatrul Metropolis',
      title: 'Club 27',
      date: '2026-09-08',
      time: '19:00',
      hall: 'Sala Mare',
      ticketState: 'sold-out',
      link: 'https://teatrulmetropolis.ro/spectacol/club-27/',
    })
    expect(club27.image).toContain('Afis-Club-27')
    expect(club27.price).toBeNull() // this page never publishes one
  })

  it('keeps the venue as Metropolis even when a co-produced night’s own ticket link points off-domain', () => {
    // Hedwig and the Angry Inch is a Teatrul Stela Popescu co-production —
    // its own link and ticket anchor both point at teatrulstelapopescu.ro,
    // but Metropolis is who published this listing.
    const events = metropolis.parse([page], { venue, now: NOW })
    const hedwig = events.find((e) => e.title === 'Hedwig and the Angry Inch')
    expect(hedwig.venue).toBe('Teatrul Metropolis')
    expect(hedwig.link).toBe(
      'https://teatrulstelapopescu.ro/spectacol/hedwig-and-the-angry-inch-la-teatrul-metropolis-10-09-2026/',
    )
    expect(hedwig.ticketState).toBe('open')
  })

  it('reads a second hall off its own row', () => {
    const events = metropolis.parse([page], { venue, now: NOW })
    const liber = events.find((e) => e.title === 'Liber Volatilium')
    expect(liber).toMatchObject({ hall: 'Sala Mică', ticketState: 'sold-out' })
  })

  it('carries each showing’s own short description', () => {
    const events = metropolis.parse([page], { venue, now: NOW })
    const club27 = events.find((e) => e.title === 'Club 27')
    expect(club27.description).toContain('Bebelușii cică n-au amintiri')
  })

  it('reads a year-less day.month date relative to "now"', () => {
    // "8.09" read on 2026-09-01 means this year, not a year inferred from
    // scratch — same inferYear rule as every other year-less source.
    const events = metropolis.parse([page], { venue, now: NOW })
    expect(events.every((e) => e.date.startsWith('2026-09'))).toBe(true)
  })

  it('reads "none" when a showing carries no ticket anchor at all', () => {
    const announced = `<span class="cal-date">15.09</span>
      </div><div class="col-12 col-md-9">
      <div class="cboxtitle"><a href="https://teatrulmetropolis.ro/spectacol/tba/">TBA</a></div>
      <div class="cboxdet">
        <span class="show-sala">Sala Mare</span>
        <span class="show-ora">19:00</span>
        <span class="show-reval"></span>
      </div></div>`
    const events = metropolis.parse([{ body: announced }], { venue, now: NOW })
    expect(events[0].ticketState).toBe('none')
  })

  describe('prices and availability, from two sources that don’t overlap (§9.62)', () => {
    // The theatre's programme row carries no price at all. Its own detail
    // page does, for the fourteen productions it hosts; the two
    // co-productions whose links point off-domain have no detail page here —
    // and are exactly the two mystage sells. Between them, every showing.
    const config = 'https://www.mystage.ro/locatii/teatrul-metropolis-4'
    const joined = { ...venue, config }
    const mystagePage = { url: config, body: fixture('mystage-metropolis.html') }
    const detailPage = (url) => ({ url, body: fixture('metropolis-production.html') })

    it('asks for the mystage page too, and never lets it fail the venue', () => {
      const requests = metropolis.requests(joined)
      expect(requests.map((r) => r.url)).toEqual([venue.url, config])
      // The flag scan.js keys on: an enrichment source that has a bad
      // afternoon must not report the venue as unreachable.
      expect(requests[1].optional).toBe(true)
      expect(metropolis.requests(venue)).toHaveLength(1)
    })

    it('follows each production hosted on the theatre’s own site, and no further', () => {
      const followed = metropolis.follow([page], { venue: joined }).map((r) => r.url)
      // Club 27 and Liber Volatilium are the theatre's own…
      expect(followed).toContain('https://teatrulmetropolis.ro/spectacol/club-27/')
      expect(followed).toContain('https://teatrulmetropolis.ro/spectacol/liber-volatilium/')
      // …and the two co-productions live on another theatre's site, which is
      // not this reader's to parse.
      expect(followed.every((u) => u.startsWith('https://teatrulmetropolis.ro/'))).toBe(true)
      // One request per distinct production, not one per showing: Liber
      // Volatilium runs twice in the fixture and is fetched once.
      expect(new Set(followed).size).toBe(followed.length)
    })

    it('puts a detail page’s price on every showing of that production', () => {
      const url = 'https://teatrulmetropolis.ro/spectacol/liber-volatilium/'
      const events = metropolis.parse([page, mystagePage, detailPage(url)], { venue: joined, now: NOW })
      const nights = events.filter((e) => e.title === 'Liber Volatilium')
      expect(nights.length).toBeGreaterThan(1)
      expect(nights.every((e) => e.price === 59.4)).toBe(true)
    })

    it('prices the off-domain co-productions from mystage, which sells them', () => {
      const events = metropolis.parse([page, mystagePage], { venue: joined, now: NOW })
      const hedwig = events.find((e) => e.title === 'Hedwig and the Angry Inch')
      expect(hedwig.price).toBe(87.17)
      const moarte = events.find((e) => e.title === 'Moarte la Teatrul de Revistă')
      expect(moarte.price).toBe(75.95)
    })

    it('leaves the programme’s own ticket state alone, even when mystage covers the night', () => {
      // Deliberate: mystage sells these two nights, but nothing establishes
      // that its allocation is the whole house, so zero seats there would not
      // prove a sell-out. A wrong "sold out" greys out Keep and hides a show
      // you could still have seen; a wrong "tickets" costs one click.
      const events = metropolis.parse([page, mystagePage], { venue: joined, now: NOW })
      expect(events.find((e) => e.title === 'Hedwig and the Angry Inch').ticketState).toBe('open')
    })

    it('reads nothing, and breaks nothing, when the mystage page didn’t arrive', () => {
      // What an optional request looks like once it has failed: present, no body.
      const events = metropolis.parse([page, { url: config }], { venue: joined, now: NOW })
      expect(events).toHaveLength(5)
      expect(events.find((e) => e.title === 'Hedwig and the Angry Inch').price).toBeNull()
    })

    describe('parseDetailPrice — the theatre is not consistent with itself', () => {
      it('reads the Romanian comma decimal', () => {
        expect(parseDetailPrice('Preț bilet: 59,40 lei')).toBe(59.4)
      })

      it('reads a dot decimal, which four productions use instead', () => {
        expect(parseDetailPrice('Preț bilet: 49.68 lei')).toBe(49.68)
      })

      it('reads a price with no unit at all, as Liber Volatilium renders it', () => {
        expect(parseDetailPrice('Preț bilet: 69,12')).toBe(69.12)
      })

      it('is null for a free-text or zero price rather than a free show', () => {
        expect(parseDetailPrice('Preț bilet: intrare liberă')).toBeNull()
        expect(parseDetailPrice('Preț bilet: 0 lei')).toBeNull()
        expect(parseDetailPrice(null)).toBeNull()
      })
    })
  })
})
