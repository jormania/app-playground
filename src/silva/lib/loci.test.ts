import { describe, it, expect } from 'vitest'
import { toLocus, toNotionLocusProps, patchLocusProps, withoutLocus, withLocusReplaced } from './loci'

function fakePage(properties: Record<string, unknown>, id = 'locus-1') {
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

describe('toLocus', () => {
  it('reads a fully populated page', () => {
    const locus = toLocus(fakePage({
      Name: { title: [{ plain_text: 'Solitude' }] },
      Meaning: { rich_text: [{ plain_text: 'Things about being alone on purpose.' }] },
      Coined: { date: { start: '2026-06-01' } },
    }))

    expect(locus).toEqual({
      id: 'locus-1',
      name: 'Solitude',
      meaning: 'Things about being alone on purpose.',
      coined: '2026-06-01',
    })
  })

  it('defaults a bare page — no meaning, no coined date', () => {
    const locus = toLocus(fakePage({ Name: { title: [{ plain_text: 'Untitled clearing' }] } }))
    expect(locus.meaning).toBe('')
    expect(locus.coined).toBe('')
  })
})

describe('toNotionLocusProps', () => {
  it('round-trips through toLocus', () => {
    const original = {
      id: 'locus-1',
      name: 'Solitude',
      meaning: 'Things about being alone on purpose.',
      coined: '2026-06-01',
    }
    const notionProps = echoPlainText(toNotionLocusProps(original))
    const roundtripped = toLocus(fakePage(notionProps, original.id))
    expect(roundtripped).toEqual(original)
  })
})

describe('patchLocusProps', () => {
  it('a rename patch writes ONLY Name — never touches Meaning or Coined', () => {
    const props = patchLocusProps({ name: 'Solitude, chosen' })
    expect(Object.keys(props)).toEqual(['Name'])
  })

  it('an empty patch writes nothing', () => {
    expect(patchLocusProps({})).toEqual({})
  })
})

describe('withoutLocus', () => {
  it('removes only the named locus, leaving others untouched', () => {
    expect(withoutLocus(['a', 'b', 'c'], 'b')).toEqual(['a', 'c'])
  })

  it('is a no-op when the locus is not present', () => {
    expect(withoutLocus(['a', 'c'], 'b')).toEqual(['a', 'c'])
  })
})

describe('withLocusReplaced', () => {
  it('replaces the merged-away locus id with the survivor', () => {
    expect(withLocusReplaced(['a', 'b'], 'b', 'a')).toEqual(['a'])
  })

  it('dedupes if the thing was already in both loci', () => {
    expect(withLocusReplaced(['a', 'b', 'c'], 'b', 'a')).toEqual(['a', 'c'])
  })

  it('is a no-op when the from-locus is not present', () => {
    expect(withLocusReplaced(['a', 'c'], 'b', 'a')).toEqual(['a', 'c'])
  })
})
