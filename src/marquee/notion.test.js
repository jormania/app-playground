import { describe, it, expect } from 'vitest'
import { fromVenuePage, toVenueProps, statusProps, scanResultProps, PROP } from './notion.js'
import { normalizeVenue } from './venues.js'

const page = {
  id: 'page-1',
  properties: {
    [PROP.name]: { title: [{ plain_text: 'Cinema Union' }] },
    [PROP.url]: { url: 'https://eventbook.ro/hall/cinema-union' },
    [PROP.adapter]: { select: { name: 'eventbook' } },
    [PROP.config]: { rich_text: [{ plain_text: 'cinema-union' }] },
    [PROP.status]: { select: { name: 'paused' } },
    [PROP.category]: { select: { name: 'movie' } },
    [PROP.area]: { select: { name: 'centru' } },
    [PROP.address]: { rich_text: [{ plain_text: 'Str. Ion Câmpineanu 21' }] },
    [PROP.lastChecked]: { date: { start: '2026-08-26' } },
    [PROP.lastResult]: { rich_text: [{ plain_text: '1 event' }] },
    [PROP.notes]: { rich_text: [] },
  },
}

describe('fromVenuePage', () => {
  it('maps every column', () => {
    expect(fromVenuePage(page)).toEqual({
      id: 'page-1',
      name: 'Cinema Union',
      url: 'https://eventbook.ro/hall/cinema-union',
      adapter: 'eventbook',
      config: 'cinema-union',
      status: 'paused',
      category: 'movie',
      area: 'centru',
      address: 'Str. Ion Câmpineanu 21',
      lastChecked: '2026-08-26',
      lastResult: '1 event',
      notes: null,
    })
  })

  it('survives a half-filled row rather than throwing', () => {
    const bare = fromVenuePage({ id: 'x', properties: { [PROP.name]: { title: [{ plain_text: 'Bare' }] } } })
    expect(bare).toMatchObject({ name: 'Bare', url: '', status: 'active', category: 'event' })
  })

  it('defaults an unknown status to active — a typo in Notion must not silently pause a venue', () => {
    const odd = fromVenuePage({ id: 'x', properties: { [PROP.status]: { select: { name: 'snoozed' } } } })
    expect(odd.status).toBe('active')
  })
})

describe('toVenueProps', () => {
  it('round-trips through fromVenuePage', () => {
    const venue = fromVenuePage(page)
    const props = toVenueProps(venue)
    const rebuilt = fromVenuePage({ id: venue.id, properties: props })
    // Last Checked / Last Result belong to a scan, not to an edit.
    expect(rebuilt).toEqual({ ...venue, lastChecked: null, lastResult: null })
  })

  it('never writes the scan columns, so editing a venue cannot blank its history', () => {
    const props = toVenueProps(normalizeVenue({ name: 'X', url: 'https://x.ro' }))
    expect(props[PROP.lastChecked]).toBeUndefined()
    expect(props[PROP.lastResult]).toBeUndefined()
  })

  it('keeps a select value inside the closed vocabulary, so a bad one cannot 400 the whole patch', () => {
    // Notion select options are closed: writing an unregistered name rejects the
    // ENTIRE patch, silently failing the unrelated fields alongside it.
    const props = toVenueProps({ name: 'X', url: 'https://x.ro', category: 'brunch', area: 'atlantis' })
    expect(props[PROP.category].select).toEqual({ name: 'event' }) // falls back to the default
    expect(props[PROP.area].select).toBeNull() // no sensible default — write nothing
  })

  it('writes an empty rich_text array rather than a null for a blank field', () => {
    const props = toVenueProps({ name: 'X', url: 'https://x.ro' })
    expect(props[PROP.notes].rich_text).toEqual([])
  })
})

describe('narrow patches', () => {
  it('statusProps touches one column', () => {
    expect(Object.keys(statusProps('paused'))).toEqual([PROP.status])
    expect(statusProps('nonsense')[PROP.status].select).toEqual({ name: 'active' })
  })

  it('scanResultProps touches only the scan columns, and clears a missing date', () => {
    const props = scanResultProps({ checkedAt: null, result: '' })
    expect(Object.keys(props).sort()).toEqual([PROP.lastChecked, PROP.lastResult].sort())
    expect(props[PROP.lastChecked].date).toBeNull()
  })
})
