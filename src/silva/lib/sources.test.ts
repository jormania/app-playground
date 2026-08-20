import { describe, it, expect } from 'vitest'
import { toSource, toNotionSourceProps, patchSourceProps, orderWithinSource } from './sources'

function fakePage(properties: Record<string, unknown>, id = 'source-1') {
  return { id, properties }
}

function echoPlainText(properties: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(properties), (_key, value) => {
    if (value && typeof value === 'object' && value.text && typeof value.text.content === 'string') {
      return { ...value, plain_text: value.text.content }
    }
    return value
  })
}

describe('toSource', () => {
  it('reads a fully populated page', () => {
    const source = toSource(fakePage({
      Title: { title: [{ plain_text: 'Meditations' }] },
      Author: { rich_text: [{ plain_text: 'Marcus Aurelius' }] },
      Kind: { select: { name: 'Book' } },
      'Kobo Volume ID': { rich_text: [{ plain_text: 'vol-123' }] },
      Notes: { rich_text: [{ plain_text: 'Gregory Hays translation.' }] },
    }))

    expect(source).toEqual({
      id: 'source-1',
      title: 'Meditations',
      author: 'Marcus Aurelius',
      kind: 'Book',
      cover: null,
      koboVolumeId: 'vol-123',
      notes: 'Gregory Hays translation.',
    })
  })

  it('defaults a bare page — no author, no kind, no kobo id', () => {
    const source = toSource(fakePage({ Title: { title: [{ plain_text: 'Untitled' }] } }))
    expect(source.author).toBe('')
    expect(source.kind).toBeNull()
    expect(source.koboVolumeId).toBeNull()
  })
})

describe('toNotionSourceProps', () => {
  it('round-trips through toSource', () => {
    const original = {
      id: 'source-1',
      title: 'Meditations',
      author: 'Marcus Aurelius',
      kind: 'Book' as const,
      cover: null,
      koboVolumeId: 'vol-123',
      notes: 'Gregory Hays translation.',
    }
    const notionProps = echoPlainText(toNotionSourceProps(original))
    const roundtripped = toSource(fakePage(notionProps, original.id))
    expect(roundtripped).toEqual(original)
  })
})

describe('patchSourceProps', () => {
  it('a koboVolumeId backfill writes ONLY Kobo Volume ID — never touches Title', () => {
    const props = patchSourceProps({ koboVolumeId: 'vol-456' })
    expect(Object.keys(props)).toEqual(['Kobo Volume ID'])
  })
})

describe('orderWithinSource', () => {
  function passage(id: string, locator: string, kept: string) {
    return { id, locator, kept }
  }

  it('orders by the page number in the locator, not by when it was kept', () => {
    const ordered = orderWithinSource([
      passage('late-page', 'p. 200', '2026-01-01'),
      passage('early-page', 'p. 12', '2026-06-01'),
      passage('mid-page', 'p. 88', '2026-03-01'),
    ])
    expect(ordered.map((t) => t.id)).toEqual(['early-page', 'mid-page', 'late-page'])
  })

  it('falls back to kept order when nothing has a number', () => {
    const ordered = orderWithinSource([
      passage('second', 'overheard on the way out', '2026-02-01'),
      passage('first', 'overheard at the door', '2026-01-01'),
    ])
    expect(ordered.map((t) => t.id)).toEqual(['first', 'second'])
  })

  // A source with a mix of paged and unplaced things still orders what it
  // can — the paged ones lead, the rest trail in kept order.
  it('puts locator-less things after every numbered one', () => {
    const ordered = orderWithinSource([
      passage('no-locator', '', '2026-01-01'),
      passage('page-9', 'p. 9', '2026-05-01'),
    ])
    expect(ordered.map((t) => t.id)).toEqual(['page-9', 'no-locator'])
  })

  it('does not mutate the input array', () => {
    const input = [passage('b', 'p. 2', '2026-01-01'), passage('a', 'p. 1', '2026-01-01')]
    const copy = [...input]
    orderWithinSource(input)
    expect(input).toEqual(copy)
  })
})

/**
 * `Cover` was read by Roots and written by nothing — the one field in the
 * Sources schema with no way in. The Kobo import fills it from the book's
 * ISBN, which means this payload shape has to be right: a files property
 * Notion rejects fails the whole import, not just the picture.
 */
describe('toNotionSourceProps — Cover', () => {
  it('writes a cover as an external file, which needs no upload', () => {
    expect(toNotionSourceProps({ cover: 'https://covers.openlibrary.org/b/isbn/9780140449334-L.jpg' })).toMatchObject({
      Cover: {
        files: [{
          type: 'external',
          name: 'cover.jpg',
          external: { url: 'https://covers.openlibrary.org/b/isbn/9780140449334-L.jpg' },
        }],
      },
    })
  })

  it('clears a cover with an empty list rather than a null', () => {
    expect(toNotionSourceProps({ cover: null })).toMatchObject({ Cover: { files: [] } })
  })

  // The whole point of the pruning: backfilling a cover onto a matched book
  // must not re-send — and so must not clobber — its title or notes.
  it('is only sent when the patch actually names it', () => {
    expect(Object.keys(patchSourceProps({ cover: 'https://example.com/c.jpg' }))).toEqual(['Cover'])
    expect(patchSourceProps({ koboVolumeId: 'vol-1' })).not.toHaveProperty('Cover')
  })
})

/**
 * Today's Kobo import writes a chapter title when the file names one and a
 * position — "63% in" — when it doesn't (lib/kobo.ts `koboLocator`). Read
 * as "the first run of digits", that position masquerades as *page 63* and
 * sorts ahead of page 100 of the same book. A percentage and a page number
 * are different scales, so they have to be compared as different kinds.
 */
describe('orderWithinSource — a position is not a page', () => {
  const t = (locator: string, kept: string) => ({ locator, kept })

  it('orders percentage positions among themselves, in reading order', () => {
    const ordered = orderWithinSource([
      t('90% in', '2026-01-01'),
      t('12% in', '2026-01-01'),
      t('63% in', '2026-01-01'),
    ])
    expect(ordered.map((x) => x.locator)).toEqual(['12% in', '63% in', '90% in'])
  })

  it('orders page numbers among themselves', () => {
    const ordered = orderWithinSource([t('p. 142', '2026-01-01'), t('p. 7', '2026-01-01')])
    expect(ordered.map((x) => x.locator)).toEqual(['p. 7', 'p. 142'])
  })

  // The actual defect: 63 is not a page, and must not outrank page 100.
  it('never lets a percentage outrank a real page number', () => {
    const ordered = orderWithinSource([t('63% in', '2026-01-01'), t('p. 100', '2026-01-01')])
    expect(ordered.map((x) => x.locator)).toEqual(['p. 100', '63% in'])
  })

  // A chapter title carries no number at all, so it falls back to kept order
  // rather than being pushed around by one it doesn't have.
  it('falls back to kept order for locators with no position in them', () => {
    const ordered = orderWithinSource([
      t('Book II', '2026-01-02'),
      t('Book I', '2026-01-01'),
    ])
    expect(ordered.map((x) => x.locator)).toEqual(['Book I', 'Book II'])
  })

  it('still reads a bus number as no page at all', () => {
    const ordered = orderWithinSource([
      t('overheard on the 32 tram', '2026-01-02'),
      t('p. 200', '2026-01-01'),
    ])
    expect(ordered[0].locator).toBe('p. 200')
  })
})
