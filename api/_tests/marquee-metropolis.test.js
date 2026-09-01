// Teatrul Metropolis, against markup actually served by
// teatrulmetropolis.ro/program/ on 2026-09-01
// (api/_lib/marquee/__fixtures__/metropolis-program.html) — trimmed to the
// live page's own first 4 showings, not edited.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import metropolis from '../_lib/marquee/metropolis.js'

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
  it('reads all four showings in the fixture', () => {
    const events = metropolis.parse([page], { venue, now: NOW })
    expect(events).toHaveLength(4)
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
})
