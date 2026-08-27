import { describe, it, expect } from 'vitest'
import {
  normalizeVenue,
  validateVenue,
  sameProgramme,
  scannable,
  togglePaused,
  sortVenues,
  suggestName,
} from './venues.js'
import { matchAdapter, parseUrl } from './adapters.js'

describe('matchAdapter', () => {
  it('routes each real venue to its reader', () => {
    expect(matchAdapter('https://teatrul-excelsior.ro/program/').adapter).toBe('excelsior')
    expect(matchAdapter('https://www.filarmonicaenescu.ro/ro/evenimente').adapter).toBe('filarmonica')
    expect(matchAdapter('https://tickets.expirat.org/').adapter).toBe('expirat')
  })

  it('reads the eventbook hall slug out of the URL, so four venues share one reader', () => {
    for (const slug of ['cinema-union', 'cinema-elvire-popesco', 'club-control']) {
      const m = matchAdapter(`https://eventbook.ro/hall/${slug}`)
      expect(m).toMatchObject({ adapter: 'eventbook', config: slug })
    }
  })

  it('refuses an eventbook URL that names no hall — there would be nothing to watch', () => {
    expect(matchAdapter('https://eventbook.ro/')).toBeNull()
    expect(matchAdapter('https://eventbook.ro/film/bilete-iertarea')).toBeNull()
  })

  it('tolerates a missing scheme and a www prefix, and returns null for nonsense', () => {
    expect(matchAdapter('teatrul-excelsior.ro/program/').adapter).toBe('excelsior')
    expect(matchAdapter('https://www.teatrul-excelsior.ro/program/').adapter).toBe('excelsior')
    expect(matchAdapter('not a url')).toBeNull()
    expect(matchAdapter('')).toBeNull()
  })

  it('does not match an unrelated site — jsonld is never chosen by domain', () => {
    expect(matchAdapter('https://example.com/events')).toBeNull()
  })

  it('is not fooled by a lookalike host', () => {
    expect(parseUrl('https://eventbook.ro.evil.example/hall/x')).not.toBeNull()
    expect(matchAdapter('https://eventbook.ro.evil.example/hall/x')).toBeNull()
  })

  it('reads the venue id out of an iabilet.ro venue page URL', () => {
    const m = matchAdapter('https://www.iabilet.ro/bilete-cinema-europa-venue-5877/')
    expect(m).toMatchObject({ adapter: 'iabilet', config: '5877' })
  })

  it('refuses a plain iabilet.ro event page — there is no venue to fan out from', () => {
    // Only a venue page (…-venue-<id>/) has the weekly-bundle links this reader
    // needs; a single show's own ticket page has nowhere to walk to.
    expect(matchAdapter('https://www.iabilet.ro/bilete-asian-spotlight-vol-2-130105/')).toBeNull()
  })
})

describe('validateVenue', () => {
  const existing = [normalizeVenue({ id: '1', name: 'Cinema Union', url: 'https://eventbook.ro/hall/cinema-union' })]

  it('accepts a supported venue and resolves its reader from the URL', () => {
    const r = validateVenue({ name: 'Excelsior', url: 'https://teatrul-excelsior.ro/program/' }, existing)
    expect(r.ok).toBe(true)
    expect(r.matched).toBe(true)
    expect(r.venue.adapter).toBe('excelsior')
    expect(r.warnings).toEqual([])
  })

  it('blocks a venue with no name or no URL, and says which field is at fault', () => {
    const noName = validateVenue({ url: 'https://teatrul-excelsior.ro/program/' })
    expect(noName.ok).toBe(false)
    expect(noName.problemFor('name')).toBeTruthy()
    expect(noName.problemFor('url')).toBeUndefined()

    const noUrl = validateVenue({ name: 'Somewhere' })
    expect(noUrl.ok).toBe(false)
    expect(noUrl.problemFor('url')).toBeTruthy()
  })

  it('blocks a duplicate programme page, however it is written', () => {
    const r = validateVenue({ name: 'Union again', url: 'http://www.eventbook.ro/hall/cinema-union/' }, existing)
    expect(r.ok).toBe(false)
    expect(r.problemFor('url')).toMatch(/already watches/)
  })

  it('lets a venue edit itself without tripping the duplicate check', () => {
    const r = validateVenue({ id: '1', name: 'Cinema Union', url: 'https://eventbook.ro/hall/cinema-union' }, existing)
    expect(r.ok).toBe(true)
  })

  it('allows an unsupported site through the generic reader, but says so out loud', () => {
    const r = validateVenue({ name: 'Somewhere new', url: 'https://example.com/program' })
    expect(r.ok).toBe(true)
    expect(r.matched).toBe(false)
    expect(r.venue.adapter).toBe('jsonld')
    expect(r.warnings.join(' ')).toMatch(/adapter written/)
  })

  it('ignores a stale adapter id on the draft rather than trusting it as the parser', () => {
    const r = validateVenue({ name: 'X', url: 'https://teatrul-excelsior.ro/program/', adapter: 'eventbook' })
    expect(r.venue.adapter).toBe('excelsior')
  })

  it('drops the old site’s reader when a venue is moved to a site nothing matches', () => {
    // Filarmonica, moved to a source no reader knew: the form warned "no built-in
    // reader for this site" while the row quietly kept `filarmonica`, so the next
    // check went on failing against a site that was no longer being watched.
    // What the form says is what gets saved.
    const r = validateVenue({ name: 'Filarmonica', url: 'https://example.com/tickets', adapter: 'filarmonica' })
    expect(r.matched).toBe(false)
    expect(r.venue.adapter).toBe('jsonld')
    expect(r.warnings.join(' ')).toMatch(/No built-in reader/)
  })

  it('keeps a generic reader across a URL change, since it claims no site', () => {
    const r = validateVenue({ name: 'X', url: 'https://example.org/whats-on', adapter: 'jsonld' })
    expect(r.venue.adapter).toBe('jsonld')
  })

  it('routes an Oveit hub URL to the Oveit reader, vendor id and all', () => {
    const r = validateVenue({ name: 'Filarmonica', url: 'https://oveit.com/hub/org/l7PDAr7y' })
    expect(r.venue.adapter).toBe('oveit')
    expect(r.venue.config).toBe('l7PDAr7y')
    expect(r.matched).toBe(true)
  })

  it('keeps a deliberately-pinned adapter on a no-op save, even though the URL would auto-match a different one', () => {
    // Quantic's own URL (iabilet.ro/bilete-*-venue-<id>/) is structurally
    // identical to Cinema Europa's, so matchAdapter genuinely returns
    // 'iabilet' for it — but Quantic's venue page needs the GENERIC reader
    // (see adapters.js's own header), so its row is pinned to 'quantic'
    // instead. Editing something else about the row (Notes, say) and saving
    // without touching the URL must not silently flip it back to 'iabilet'.
    const quantic = normalizeVenue({
      id: 'q1', name: 'Quantic', url: 'https://www.iabilet.ro/bilete-quantic-venue-1705/', adapter: 'quantic',
    })
    const r = validateVenue({ ...quantic, notes: 'Some new note' }, [quantic])
    expect(r.venue.adapter).toBe('quantic')
    expect(r.venue.config).toBe(quantic.config)
  })

  it('still re-resolves normally when a pinned venue’s URL genuinely changes', () => {
    // The opposite case, so the fix above can't regress into never
    // re-checking a pinned adapter at all — a real site change still has to
    // go through the ordinary matched-vs-carried logic.
    const quantic = normalizeVenue({
      id: 'q1', name: 'Quantic', url: 'https://www.iabilet.ro/bilete-quantic-venue-1705/', adapter: 'quantic',
    })
    const r = validateVenue({ ...quantic, url: 'https://teatrul-excelsior.ro/program/' }, [quantic])
    expect(r.venue.adapter).toBe('excelsior')
  })
})

describe('pausing', () => {
  const venues = [
    normalizeVenue({ id: 'a', name: 'Active', url: 'https://teatrul-excelsior.ro/program/', adapter: 'excelsior' }),
    normalizeVenue({ id: 'b', name: 'Paused', url: 'https://tickets.expirat.org/', adapter: 'expirat', status: 'paused' }),
  ]

  it('leaves a paused venue in the list but out of every scan', () => {
    expect(venues).toHaveLength(2)
    expect(scannable(venues).map((v) => v.id)).toEqual(['a'])
  })

  it('round-trips', () => {
    expect(togglePaused(venues[0]).status).toBe('paused')
    expect(togglePaused(togglePaused(venues[0])).status).toBe('active')
  })

  it('skips a venue with no reader even when it is active', () => {
    const broken = normalizeVenue({ id: 'c', name: 'Broken', url: 'https://example.com', adapter: 'unsupported' })
    expect(scannable([...venues, broken]).map((v) => v.id)).toEqual(['a'])
  })

  it('sorts by name, leaving paused venues in place', () => {
    const list = [
      normalizeVenue({ id: '1', name: 'Zed', status: 'active' }),
      normalizeVenue({ id: '2', name: 'Alpha', status: 'paused' }),
      normalizeVenue({ id: '3', name: 'Beta', status: 'active' }),
    ]
    expect(sortVenues(list).map((v) => v.name)).toEqual(['Alpha', 'Beta', 'Zed'])
  })

  it('sorts Romanian diacritics where a reader expects them', () => {
    const list = ['Teatrul Excelsior', 'Cinema Muzeul Țăranului', 'Club Control']
      .map((name, i) => normalizeVenue({ id: String(i), name }))
    expect(sortVenues(list).map((v) => v.name))
      .toEqual(['Cinema Muzeul Țăranului', 'Club Control', 'Teatrul Excelsior'])
  })
})

describe('sameProgramme', () => {
  it('sees through scheme, www, trailing slash and query order', () => {
    expect(sameProgramme('https://eventbook.ro/hall/x', 'http://www.eventbook.ro/hall/x/')).toBe(true)
    expect(sameProgramme('https://a.ro/p?b=2&a=1', 'https://a.ro/p?a=1&b=2')).toBe(true)
  })

  it('keeps different halls on the same site apart', () => {
    expect(sameProgramme('https://eventbook.ro/hall/x', 'https://eventbook.ro/hall/y')).toBe(false)
  })
})

describe('suggestName', () => {
  it('turns a hall slug into a readable name', () => {
    expect(suggestName('https://eventbook.ro/hall/cinema-union')).toBe('Cinema Union')
  })

  it('falls back to the host when the path says nothing', () => {
    expect(suggestName('https://tickets.expirat.org/')).toBe('Tickets')
    expect(suggestName('')).toBe('')
  })
})
