import { describe, test, expect } from 'vitest'
import { toDraft, toFindingsPage, expiryFor, placeFor, mapUrlFor, appUrlFor } from './wanderlist.js'
import { normalizeEvent } from './model.js'
import { goUrlFor } from './EventDetail.jsx'

const ev = (over) => normalizeEvent({ name: 'Trio Nocturn', ...over })
const NOW = new Date(2026, 7, 19, 15, 0)

describe('placeFor', () => {
  test('venue plus street plus city — a bare name does not geocode', () => {
    expect(placeFor(ev({ venue: 'Control Club', address: 'Str. Mille 4' })))
      .toBe('Control Club, Str. Mille 4, București')
  })

  test('does not append București twice', () => {
    expect(placeFor(ev({ venue: 'Control Club, Str. Mille 4, București' })))
      .toBe('Control Club, Str. Mille 4, București')
  })

  test('at minimum appends the city to a bare venue name', () => {
    expect(placeFor(ev({ venue: 'ARCUB' }))).toBe('ARCUB, București')
  })

  test('no place at all stays null rather than inventing one', () => {
    expect(placeFor(ev({}))).toBeNull()
    expect(mapUrlFor(ev({}))).toBeNull()
  })
})

describe('appUrlFor', () => {
  const ID = 'de3705a1d9e94c0fb1a7c5e2d0846f31'

  test('links into the Wanderlist app, not at the Notion page', () => {
    // The Notion page is already listed as the `saved` source in provenance;
    // a second link to it would be the same destination twice.
    expect(appUrlFor(ev({ findingsId: ID }))).toBe(`/wanderlist-react.html#/entry/${ID}`)
  })

  test('folds Notion’s dashed id so both spellings give one link', () => {
    const dashed = 'de3705a1-d9e9-4c0f-b1a7-c5e2d0846f31'
    expect(appUrlFor(ev({ findingsId: dashed }))).toBe(appUrlFor(ev({ findingsId: ID })))
  })

  test('offers nothing rather than a broken link when the id is not a page id', () => {
    expect(appUrlFor(ev({}))).toBeNull()
    expect(appUrlFor(ev({ findingsId: 'demo-saved-1' }))).toBeNull()
    expect(appUrlFor(ev({ findingsId: ID.slice(0, 20) }))).toBeNull()
  })
})

describe('expiryFor', () => {
  test('a one-off event expires on its own date — missing it means missing it', () => {
    expect(expiryFor(ev({ start: '2026-08-21' }))).toBe('2026-08-21')
  })

  test('a run expires on its closing date', () => {
    expect(expiryFor(ev({ start: '2026-08-01', end: '2026-11-01' }))).toBe('2026-11-01')
  })

  test('a recurring event gets no invented deadline', () => {
    expect(expiryFor(ev({ start: '2026-08-21', signals: ['recurring'] }))).toBeNull()
  })

  test('an undated event gets no deadline either', () => {
    expect(expiryFor(ev({ start: null }))).toBeNull()
  })
})

describe('toDraft', () => {
  const event = ev({
    start: '2026-08-21T21:00:00+03:00', hasTime: true,
    venue: 'Control Club', address: 'Str. Mille 4', category: 'concert',
    summary: 'Jazz de improvizație.', cost: 60, signals: ['ticketed', 'recommended'],
    link: 'https://venue.example/x', tickets: 'https://iabilet.ro/y',
    sources: [{ name: 'Curatorial', url: 'https://curatorial.ro/z' }],
  })

  test('a new row is never going and never attended, even with a known date', () => {
    const d = toDraft(event, NOW)
    expect(d.going).toBe(false)
    expect(d.attended).toBe(false)
    expect(d.plannedDate).toBe('2026-08-21')
  })

  test('prefers the ticket link, then the event page, then nothing at all', () => {
    expect(toDraft(event, NOW).link).toBe('https://iabilet.ro/y')
    expect(toDraft(ev({ ...event, tickets: null }), NOW).link).toBe('https://venue.example/x')
    // NOT the article that mentioned it. A roundup is a place forty events are
    // listed, so as an event's Link it answers nothing you would ask of the row.
    expect(toDraft(ev({ ...event, tickets: null, link: null }), NOW).link).toBe('')
  })

  test('keeps only signals that map onto Wanderlist\'s own tag vocabulary', () => {
    // `recommended` is a Radar-B concept and must not leak into Findings' tags.
    expect(toDraft(event, NOW).tags).toEqual(['ticketed'])
  })

  test('falls back to a closed-vocabulary category rather than inventing one', () => {
    expect(toDraft(ev({ category: 'nonsense' }), NOW).category).toBe('event')
  })

  test('a free event carries no cost', () => {
    expect(toDraft(ev({ signals: ['free'], cost: 60 }), NOW).cost).toBeNull()
  })

  test('description is never blank — a thin source says it is thin', () => {
    const d = toDraft(ev({ summary: null, venue: 'Control Club', sources: [{ name: 'HotNews' }] }), NOW)
    expect(d.description).toContain('Control Club')
    expect(d.description).toContain('HotNews')
    expect(d.description).toContain('de verificat')
  })

  test('stamps Date Added with today', () => {
    expect(toDraft(event, NOW).dateAdded).toBe('2026-08-19')
  })
})

describe('the mainstream signal never leaks into Wanderlist tags', () => {
  test('a "De știut" event carries no matching Findings tag', () => {
    const d = toDraft(ev({ signals: ['mainstream'] }), NOW)
    expect(d.tags).toEqual([])
  })
})

describe('toFindingsPage', () => {
  test('writes the Findings schema through the SHARED mapping, not a local copy', () => {
    const draft = toDraft(ev({ start: '2026-08-21T21:00:00+03:00', hasTime: true, venue: 'Control Club', category: 'concert', summary: 'Jazz.' }), NOW)
    const page = toFindingsPage(draft, 'db-1')
    expect(page.parent).toEqual({ database_id: 'db-1' })
    expect(page.properties.Name.title[0].text.content).toBe('Trio Nocturn')
    // Real Notion checkboxes, per WANDERLIST.md's schema.
    expect(page.properties.Attended).toEqual({ checkbox: false })
    expect(page.properties.Going).toEqual({ checkbox: false })
    expect(page.properties.Category).toEqual({ select: { name: 'concert' } })
    // A planned time is written as a full ISO datetime with an offset.
    expect(page.properties['Planned Date'].date.start).toMatch(/^2026-08-21T21:00:00[+-]\d{2}:\d{2}$/)
  })

  test('a bare planned date stays bare — no time is invented', () => {
    const draft = toDraft(ev({ start: '2026-08-21', hasTime: false }), NOW)
    expect(toFindingsPage(draft, 'db-1').properties['Planned Date'].date.start).toBe('2026-08-21')
  })
})

describe('provenance flows into Wanderlist (the return half of the two-way street)', () => {
  test('names recommenders and mentions separately — they are different signals', () => {
    const d = toDraft(ev({
      summary: 'Jazz de improvizație.',
      sources: [
        { name: 'Curatorial', kind: 'recommendation' },
        { name: 'B365', kind: 'editorial' },
        { name: 'Zile și Nopți', kind: 'editorial' },
      ],
    }), NOW)
    expect(d.description).toContain('Jazz de improvizație.')
    expect(d.description).toContain('recomandat de Curatorial')
    expect(d.description).toContain('menționat de B365, Zile și Nopți')
  })

  test('deduplicates a source that mentioned it twice', () => {
    const d = toDraft(ev({ summary: 'x', sources: [{ name: 'B365' }, { name: 'B365' }] }), NOW)
    expect(d.description.match(/B365/g)).toHaveLength(1)
  })

  test('an event with no sources gets no empty footer', () => {
    const d = toDraft(ev({ summary: 'Jazz.', sources: [] }), NOW)
    expect(d.description).toBe('Jazz.')
    expect(d.description).not.toContain('Radar-B')
  })
})

describe('placeFor — venue and address overlap far more often than they differ', () => {
  test('an address that merely restates the venue is not appended twice', () => {
    // The live Findings row said `Parcul Tei, Parcul Tei, București` — written by
    // Radar-B, from a Radar row whose Venue and Address name one park.
    expect(placeFor({ venue: 'Parcul Tei', address: 'Parcul Tei, București' }))
      .toBe('Parcul Tei, București')
  })

  test('the abbreviated-street case, which containment alone misses', () => {
    // `strada` vs `str` share no substring, so only token overlap catches this.
    expect(placeFor({
      venue: 'Strada Aviator Radu Beller (pietonală)',
      address: 'Str. Aviator Radu Beller, București',
    })).toBe('Strada Aviator Radu Beller (pietonală), București')
  })

  test('a venue and its genuinely unrelated street both survive', () => {
    // The whole point of carrying both: a bare venue name does not drop a pin.
    expect(placeFor({ venue: 'Cinema Europa', address: 'Calea Moșilor 127, București' }))
      .toBe('Cinema Europa, Calea Moșilor 127, București')
  })

  test('the longer of two overlapping strings wins, in either direction', () => {
    expect(placeFor({ venue: 'Str. Aviator Radu Beller', address: 'Str. Aviator Radu Beller 5, București' }))
      .toBe('Str. Aviator Radu Beller 5, București')
    expect(placeFor({ venue: 'Palatul Suțu, Bd. I.C. Brătianu 2, București', address: 'Palatul Suțu' }))
      .toBe('Palatul Suțu, Bd. I.C. Brătianu 2, București')
  })

  test('București is still appended when neither field mentions it', () => {
    expect(placeFor({ venue: 'Control Club', address: null })).toBe('Control Club, București')
  })

  test('nothing known stays null rather than becoming a bare city', () => {
    expect(placeFor({ venue: null, address: null })).toBeNull()
  })
})

describe('the demo handoff actually lands', () => {
  test('Radar-B\'s saved fixture is a real entry in Wanderlist\'s fixtures', async () => {
    // Demo mode is the ONLY place this handoff can be exercised without a Notion
    // token, so it has to resolve. Both fixtures being separately Notion-SHAPED
    // is not enough and was the earlier bug: each app's tests passed on its own
    // id while every demo tap landed on Wanderlist's "couldn't find that item".
    const { DEMO_SAVED } = await import('./fixtures.js')
    const { seedEntries } = await import('../wanderlist/fixtures.js')
    const { entryIdFromHash, findById } = await import('../wanderlist/deeplink.js')

    const url = appUrlFor({ findingsId: DEMO_SAVED[0].id })
    expect(url).toBeTruthy()
    const id = entryIdFromHash(url.slice(url.indexOf('#')))
    expect(findById(seedEntries(), id)).toBeTruthy()
  })
})

describe('the fallback description, for an event whose source gave nothing', () => {
  const thin = (p) => normalizeEvent({ name: 'Lansare de carte la Cărturești Verona', summary: null, ...p })

  test('the venue is not appended when the name already carries it', () => {
    // `… la Cărturești Verona la Cărturești Verona.` reached a real draft.
    const d = toDraft(thin({ venue: 'Cărturești Verona' }))
    expect(d.description).toBe('Lansare de carte la Cărturești Verona. Sursă subțire — de verificat.')
  })

  test('a venue the name does not mention is still worth adding', () => {
    const d = toDraft(normalizeEvent({ name: 'Lansare de carte', venue: 'Cărturești Verona' }))
    expect(d.description).toBe('Lansare de carte la Cărturești Verona. Sursă subțire — de verificat.')
  })

  test('the source is named once, by the provenance footer, not twice', () => {
    const d = toDraft(thin({
      venue: 'Cărturești Verona',
      sources: [{ name: 'HotNews', url: 'https://hotnews.ro/x', kind: 'editorial' }],
    }))
    expect(d.description).toContain('📡 Via Radar-B — menționat de HotNews.')
    expect(d.description).not.toContain('Semnalat via')
    expect(d.description.match(/HotNews/g)).toHaveLength(1)
  })
})

describe('a roundup article is never written as the event\'s Link', () => {
  const roundup = { name: 'B365', url: 'https://b365.ro/timp-liber/', kind: 'editorial' }

  test('no event page means a blank Link, not the article that mentioned it', () => {
    // The live Balkanik Findings row points at a B365 section listing forty other
    // things, because this used to fall through to the first source with a URL.
    expect(toDraft(normalizeEvent({ name: 'Balkanik Festival', sources: [roundup] })).link).toBe('')
  })

  test('the event\'s own page is still preferred, and tickets beat it', () => {
    expect(toDraft(normalizeEvent({ name: 'X', link: 'https://balkanikfestival.ro', sources: [roundup] })).link)
      .toBe('https://balkanikfestival.ro')
    expect(toDraft(normalizeEvent({ name: 'X', link: 'https://balkanikfestival.ro', tickets: 'https://iabilet.ro/x' })).link)
      .toBe('https://iabilet.ro/x')
  })

  test('the draft agrees with what the detail view is willing to offer', () => {
    // `goUrlFor` already declined to show a source URL as an "event page"
    // button; writing one anyway made the two disagree about the same event.
    const e = normalizeEvent({ name: 'Balkanik Festival', sources: [roundup] })
    expect(toDraft(e).link).toBe(goUrlFor(e) ?? '')
  })
})
