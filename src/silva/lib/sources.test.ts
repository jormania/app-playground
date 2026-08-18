import { describe, it, expect } from 'vitest'
import { toSource, toNotionSourceProps, patchSourceProps } from './sources'

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
