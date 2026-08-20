import { describe, it, expect } from 'vitest'
import { toThing, toNotionThingProps, patchProps, deriveHandle } from './notion'

function fakePage(properties: Record<string, unknown>, id = 'thing-1', createdTime?: string) {
  return { id, properties, ...(createdTime ? { created_time: createdTime } : {}) }
}

/** A real Notion page fetched back after a write always carries BOTH
 *  `text.content` and a server-computed `plain_text` on every rich-text run
 *  — `toNotionThingProps`'s write payload only sets `text.content` (Notion
 *  computes `plain_text` itself). Mirror that here so the round-trip test
 *  below reads a realistic fetched shape, not a raw write payload. */
function echoPlainText(properties: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(properties), (key, value) => {
    if (key === 'text' && value && typeof value.content === 'string') {
      return value
    }
    if (value && typeof value === 'object' && value.text && typeof value.text.content === 'string') {
      return { ...value, plain_text: value.text.content }
    }
    return value
  })
}

describe('deriveHandle', () => {
  it('leaves a short body untouched', () => {
    expect(deriveHandle('A short passage.')).toBe('A short passage.')
  })

  it('cuts a long body on a word boundary and adds an ellipsis', () => {
    const body = 'a'.repeat(20) + ' ' + 'b'.repeat(50)
    const handle = deriveHandle(body, 30)
    expect(handle.endsWith('…')).toBe(true)
    expect(handle.length).toBeLessThanOrEqual(31)
    expect(handle).not.toContain(' b'.repeat(1) + 'b') // didn't cut mid-word
  })

  it('collapses internal whitespace before measuring', () => {
    expect(deriveHandle('one   \n  two')).toBe('one two')
  })
})

describe('toThing', () => {
  it('reads a fully populated page', () => {
    const thing = toThing(fakePage({
      Handle: { title: [{ plain_text: 'A gathered thought' }] },
      Body: { rich_text: [{ plain_text: 'The full ' }, { plain_text: 'passage.' }] },
      Kind: { select: { name: 'Passage' } },
      State: { select: { name: 'Kept' } },
      Source: { relation: [{ id: 'source-1' }] },
      Locator: { rich_text: [{ plain_text: 'p. 42' }] },
      Encountered: { date: { start: '2026-05-01T00:00:00.000Z' } },
      Kept: { date: { start: '2026-05-10' } },
      Note: { rich_text: [{ plain_text: 'Why this.' }] },
      Loci: { relation: [{ id: 'locus-1' }, { id: 'locus-2' }] },
      Link: { url: 'https://example.com' },
      'Kobo Bookmark ID': { rich_text: [{ plain_text: 'bm-1' }] },
    }, 'thing-1', '2026-05-09T08:15:00.000Z'))

    expect(thing).toEqual({
      id: 'thing-1',
      handle: 'A gathered thought',
      body: 'The full passage.',
      kind: 'Passage',
      state: 'Kept',
      sourceId: 'source-1',
      locator: 'p. 42',
      encountered: '2026-05-01',
      kept: '2026-05-10',
      note: 'Why this.',
      lociIds: ['locus-1', 'locus-2'],
      image: null,
      link: 'https://example.com',
      koboBookmarkId: 'bm-1',
      arrived: '2026-05-09',
    })
  })

  it('defaults a sparse page — no kind, no source, no loci, still Understory', () => {
    const thing = toThing(fakePage({
      Handle: { title: [{ plain_text: 'Bare' }] },
      Body: { rich_text: [{ plain_text: 'Just this.' }] },
    }))

    expect(thing.kind).toBeNull()
    expect(thing.state).toBe('Understory')
    expect(thing.sourceId).toBeNull()
    expect(thing.lociIds).toEqual([])
    expect(thing.kept).toBeNull()
    expect(thing.link).toBeNull()
    expect(thing.image).toBeNull()
  })

  it('reads the first file url off an Image files property', () => {
    const thing = toThing(fakePage({
      Image: { files: [{ file: { url: 'https://files.example/a.jpg' } }] },
    }))
    expect(thing.image).toBe('https://files.example/a.jpg')
  })
})

describe('toNotionThingProps', () => {
  it('clears kind/state/source/loci with explicit null/empty rather than omitting them', () => {
    const props = toNotionThingProps({ body: 'x', kind: null, sourceId: null, lociIds: [] })
    expect(props.Kind).toEqual({ select: null })
    expect(props.Source).toEqual({ relation: [] })
    expect(props.Loci).toEqual({ relation: [] })
  })

  it('round-trips through toThing', () => {
    const original = {
      id: 'thing-1',
      handle: 'Roundtrip',
      body: 'Body text.',
      kind: 'Observation' as const,
      state: 'Kept' as const,
      sourceId: 'source-9',
      locator: 'ch. 3',
      encountered: '2026-01-01',
      kept: '2026-01-05',
      note: 'A note.',
      lociIds: ['locus-9'],
      image: null,
      link: 'https://example.com/x',
      koboBookmarkId: null,
      // Notion's own stamp, not a property — so it does not round-trip
      // through `toNotionThingProps` and reads back null from a page
      // without one. That it *can't* be written is the point: nothing in
      // Silva can forge a thing's arrival.
      arrived: null,
    }
    const notionProps = echoPlainText(toNotionThingProps(original))
    const roundtripped = toThing(fakePage(notionProps, original.id))
    expect(roundtripped).toEqual(original)
  })
})

describe('patchProps', () => {
  it('a state/kept patch writes ONLY State and Kept — never clobbers Body or Handle', () => {
    const props = patchProps({ state: 'Kept', kept: '2026-06-01' })
    expect(Object.keys(props).sort()).toEqual(['Kept', 'State'])
  })

  it('a bare release patch writes only State', () => {
    const props = patchProps({ state: 'Released' })
    expect(Object.keys(props)).toEqual(['State'])
  })

  it('an empty patch writes nothing', () => {
    expect(patchProps({})).toEqual({})
  })
})

// The season counts from when a thing reached Silva, not from the date it
// carries — see lib/understory.ts `seasonStart`. Notion stamps every page
// with `created_time`, so this needs no schema property and is already
// right for every row created before it existed.
describe('toThing — arrival', () => {
  it('reads the arrival out of Notion\'s own created_time', () => {
    const thing = toThing(fakePage({}, 'thing-2', '2026-08-20T09:00:00.000Z'))
    expect(thing.arrived).toBe('2026-08-20')
  })

  it('is null for a page with no stamp at all', () => {
    expect(toThing(fakePage({}, 'thing-3')).arrived).toBeNull()
  })
})
