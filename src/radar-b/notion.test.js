import { describe, test, expect } from 'vitest'
import { parseSources, hasTimeOf, fromRadarPage, fromFindingsPage, parseSuggestedPage } from './notion.js'

describe('parseSources', () => {
  test('reads name │ url │ date, one mention per line', () => {
    const out = parseSources('Curatorial │ https://curatorial.ro/x │ 2026-07-31\nB365 │ https://b365.ro/y │ 2026-07-30')
    expect(out).toHaveLength(2)
    expect(out[0]).toEqual({ name: 'Curatorial', url: 'https://curatorial.ro/x', date: '2026-07-31', kind: 'editorial' })
  })

  test('a leading * marks a recommendation, not a passing mention', () => {
    expect(parseSources('*Recomandata │ https://r.example │ 2026-07-31')[0].kind).toBe('recommendation')
  })

  test('tolerates a half-filled line rather than dropping it', () => {
    const out = parseSources('Buletin\nHotNews │ not-a-url')
    expect(out.map((s) => s.name)).toEqual(['Buletin', 'HotNews'])
    expect(out[1].url).toBeNull()
  })

  test('accepts a plain pipe as well as the box-drawing one', () => {
    expect(parseSources('B365 | https://b365.ro/y')[0].url).toBe('https://b365.ro/y')
  })

  test('empty input is an empty list, never a throw', () => {
    expect(parseSources(null)).toEqual([])
    expect(parseSources('')).toEqual([])
  })
})

describe('hasTimeOf', () => {
  test('is exactly the bare-date vs datetime distinction Notion encodes', () => {
    expect(hasTimeOf('2026-08-21')).toBe(false)
    expect(hasTimeOf('2026-08-21T21:00:00+03:00')).toBe(true)
    expect(hasTimeOf(null)).toBe(false)
  })
})

const radarPage = {
  id: 'page-1',
  properties: {
    Name: { title: [{ plain_text: 'Lumină difuză' }] },
    When: { date: { start: '2026-08-21', end: '2026-11-01' } },
    Venue: { rich_text: [{ plain_text: 'Combinatul Fondului Plastic' }] },
    Address: { rich_text: [{ plain_text: 'Str. Băiculești 29' }] },
    Area: { select: { name: 'Bucureștii Noi' } },
    Category: { select: { name: 'Art' } },
    Summary: { rich_text: [{ plain_text: 'Six artists.' }] },
    Signals: { multi_select: [{ name: 'Free' }] },
    Cost: { number: null },
    Link: { url: 'https://venue.example/x' },
    Confidence: { select: { name: 'confirmed' } },
    Checked: { date: { start: '2026-08-20' } },
    Key: { rich_text: [{ plain_text: 'cfp:lumina' }] },
    Sources: { rich_text: [{ plain_text: '*Curatorial │ https://curatorial.ro/x │ 2026-07-31' }] },
  },
}

describe('fromRadarPage', () => {
  test('maps a full row into the app model', () => {
    const e = fromRadarPage(radarPage)
    expect(e.name).toBe('Lumină difuză')
    expect(e.start).toBe('2026-08-21')
    expect(e.end).toBe('2026-11-01')
    expect(e.hasTime).toBe(false)
    expect(e.confidence).toBe('confirmed')
    expect(e.key).toBe('cfp:lumina')
  })

  test('lowercases the select-y fields, matching the Wanderlist casing rule', () => {
    const e = fromRadarPage(radarPage)
    expect(e.category).toBe('art')
    expect(e.area).toBe('bucureștii noi')
    expect(e.signals).toContain('free')
  })

  test('a recommending source implies the recommended signal — the two cannot disagree', () => {
    expect(fromRadarPage(radarPage).signals).toContain('recommended')
  })

  test('an almost-empty row degrades instead of throwing', () => {
    const e = fromRadarPage({ id: 'p', properties: {} })
    expect(e.name).toBe('(fără titlu)')
    expect(e.start).toBeNull()
    expect(e.sources).toEqual([])
  })
})

describe('fromFindingsPage', () => {
  const page = {
    id: 'f-1',
    url: 'https://notion.so/f-1',
    properties: {
      Name: { title: [{ plain_text: 'Trio Nocturn' }] },
      Description: { rich_text: [{ plain_text: 'Jazz.' }] },
      Place: { rich_text: [{ plain_text: 'Control Club, Str. Mille 4' }] },
      Category: { select: { name: 'concert' } },
      Tags: { multi_select: [{ name: 'ticketed' }, { name: 'nightlife' }] },
      'Planned Date': { date: { start: '2026-08-21T21:00:00+03:00' } },
      'Date Added': { date: { start: '2026-08-19' } },
      Attended: { checkbox: false },
    },
  }

  test('a Wanderlist row becomes an ordinary event, marked saved', () => {
    const e = fromFindingsPage(page)
    expect(e.saved).toBe(true)
    expect(e.origin).toBe('wanderlist')
    expect(e.hasTime).toBe(true)
  })

  test('it carries a Wanderlist source, so provenance survives into the merge', () => {
    expect(fromFindingsPage(page).sources[0]).toMatchObject({ name: 'Wanderlist', kind: 'saved' })
  })

  test('only tags that are also Radar-B signals cross over — the rest stay Wanderlist\'s', () => {
    expect(fromFindingsPage(page).signals).toEqual(['ticketed'])
  })
})

describe('parseSuggestedPage', () => {
  const blocks = [
    { type: 'heading_2', heading_2: { rich_text: [{ plain_text: '31 iulie 2026' }] } },
    { type: 'table_row', table_row: { cells: [[{ plain_text: 'Sursă' }], [{ plain_text: 'Titlu' }]] } },
    { type: 'table_row', table_row: { cells: [[{ plain_text: '**B365**' }], [{ plain_text: 'București de weekend', href: 'https://b365.ro/x' }]] } },
    { type: 'table_row', table_row: { cells: [[{ plain_text: 'Buletin' }], [{ plain_text: '⏳ nepublicat încă' }]] } },
  ]

  test('reads the refresh date and the per-source article links', () => {
    const out = parseSuggestedPage(blocks)
    expect(out.refreshedAt).toBe('31 iulie 2026')
    expect(out.links).toHaveLength(2) // the header row is skipped
    expect(out.links[0]).toMatchObject({ source: 'B365', url: 'https://b365.ro/x', pending: false })
  })

  test('recognises the ⏳ placeholder the skill leaves for an unpublished source', () => {
    expect(parseSuggestedPage(blocks).links[1].pending).toBe(true)
  })
})
