import { describe, it, expect } from 'vitest'
import { toDraft, toFindingsPage, placeFor, mapUrlFor, tagsFor, expiryFor } from './wanderlist.js'
import { toProductions } from './programme.js'

const venue = {
  name: 'Expirat Halele Carol',
  address: 'Strada Doctor Constantin Istrati 1, București',
  category: 'concert',
}

const showing = {
  key: 'k',
  venue: 'Expirat Halele Carol',
  title: 'Ana Coman • Hidden Gems',
  date: '2026-08-26',
  time: '20:00',
  hall: 'Sala mare',
  link: 'https://tickets.expirat.org/event',
  ticketsUrl: 'https://tickets.expirat.org/buy',
  ticketState: 'open',
  image: 'https://example.com/poster.jpg',
  price: 50,
}

describe('placeFor', () => {
  it('joins venue and address, because a bare venue name has no map pin', () => {
    expect(placeFor(venue)).toBe('Expirat Halele Carol, Strada Doctor Constantin Istrati 1, București')
  })

  it('does not repeat a venue already inside its own address', () => {
    // The bug this prevents wrote "Parcul Tei, Parcul Tei, București" into live rows.
    expect(placeFor({ name: 'Parcul Tei', address: 'Parcul Tei, București' })).toBe('Parcul Tei, București')
  })

  it('falls back to the name alone when there is no address', () => {
    expect(placeFor({ name: 'Club Control' })).toBe('Club Control')
  })
})

describe('mapUrlFor', () => {
  it('builds the Google Maps search Wanderlist expects', () => {
    // Wanderlist has no geocoder: a row saved without Map has no pin at all.
    expect(mapUrlFor(venue)).toBe(
      'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(placeFor(venue)),
    )
  })

  it('is null rather than a search for nothing', () => {
    expect(mapUrlFor({})).toBeNull()
  })
})

describe('tagsFor', () => {
  it('states only what the venue published', () => {
    expect(tagsFor(showing, venue).sort()).toEqual(['music', 'ticketed'])
    expect(tagsFor({ ticketState: 'none' }, { category: 'movie' })).toEqual([])
  })

  it('marks a genuinely free event free', () => {
    expect(tagsFor({ ticketState: 'none', price: 0 }, {})).toEqual(['free'])
  })

  it('keeps tags inside Wanderlist’s closed vocabulary', () => {
    // An unregistered multi_select name 400s the whole patch in Notion.
    for (const tag of tagsFor(showing, venue)) {
      expect(['free', 'ticketed', 'outdoor', 'indoor', 'with-friends', 'solo', 'music', 'walk', 'food', 'nightlife', 'history', 'expo', 'beach']).toContain(tag)
    }
  })
})

describe('toDraft', () => {
  const production = toProductions([showing, { ...showing, key: 'k2', date: '2026-08-27' }])[0]
  const draft = toDraft(showing, { venue, production })

  it('carries every field the Findings schema can hold from a showing', () => {
    expect(draft).toMatchObject({
      name: 'Ana Coman • Hidden Gems',
      link: 'https://tickets.expirat.org/buy', // ticket URL beats the listing page
      category: 'concert',
      place: 'Expirat Halele Carol, Strada Doctor Constantin Istrati 1, București',
      cost: 50,
      dateExpiring: '2026-08-26',
      plannedDate: '2026-08-26',
      plannedTime: '20:00',
      attended: false,
      going: false,
    })
    expect(draft.placeUrl).toContain('google.com/maps')
    expect(draft.tags).toContain('ticketed')
    expect(draft.dateAdded).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('says the price is the cheapest published, not the price of a good seat', () => {
    expect(draft.description).toMatch(/Cheapest published ticket 50 lei/)
  })

  it('mentions the hall and the size of the run', () => {
    expect(draft.description).toMatch(/2 dates listed/)
    expect(draft.description).toMatch(/Sala mare/)
  })

  it('records a sold-out listing as a fact about when it was saved', () => {
    const gone = toDraft({ ...showing, ticketState: 'sold-out' }, { venue })
    expect(gone.description).toMatch(/sold out when saved/)
  })

  it('never marks a keep as going or attended', () => {
    expect(draft.going).toBe(false)
    expect(draft.attended).toBe(false)
  })

  it('leaves cost empty when the venue published no price', () => {
    expect(toDraft({ ...showing, price: null }, { venue }).cost).toBeNull()
  })

  it('falls back to the listing page when there is no ticket URL', () => {
    expect(toDraft({ ...showing, ticketsUrl: null }, { venue }).link).toBe('https://tickets.expirat.org/event')
  })

  it('uses the venue’s default category, and only a real one', () => {
    expect(toDraft(showing, { venue: { name: 'X', category: 'brunch' } }).category).toBe('event')
  })
})

describe('toFindingsPage', () => {
  it('produces a Notion create payload with every mapped property', () => {
    const page = toFindingsPage(toDraft(showing, { venue }), 'db-1')
    expect(page.parent).toEqual({ database_id: 'db-1' })
    const props = page.properties
    expect(props.Name.title[0].text.content).toBe('Ana Coman • Hidden Gems')
    expect(props.Cost.number).toBe(50)
    expect(props.Category.select.name).toBe('concert')
    expect(props.Map.url).toContain('google.com/maps')
    expect(props['Planned Date'].date.start).toMatch(/^2026-08-26T20:00/)
    expect(props['Date Expiring'].date.start).toBe('2026-08-26')
    expect(props.Going.checkbox).toBe(false)
    expect(props.Tags.multi_select.map((t) => t.name)).toContain('ticketed')
  })
})

describe('expiryFor', () => {
  it('is the showing’s own date — missing it means missing it', () => {
    expect(expiryFor(showing)).toBe('2026-08-26')
    expect(expiryFor({})).toBeNull()
  })
})
