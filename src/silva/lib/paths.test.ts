import { describe, it, expect } from 'vitest'
import { toPath, toNotionPathProps, patchPathProps, deriveLabel } from './paths'

function fakePage(properties: Record<string, unknown>, id = 'path-1') {
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

describe('deriveLabel', () => {
  it('joins the two handles with an arrow', () => {
    expect(deriveLabel('You have power over your mind', 'A library is organized')).toBe(
      'You have power over your mind → A library is organized',
    )
  })
})

describe('toPath', () => {
  it('reads a fully populated page', () => {
    const path = toPath(fakePage({
      Label: { title: [{ plain_text: 'A → B' }] },
      From: { relation: [{ id: 'thing-a' }] },
      To: { relation: [{ id: 'thing-b' }] },
      Why: { rich_text: [{ plain_text: 'Both about where control actually lives.' }] },
      Made: { date: { start: '2026-06-01' } },
      Origin: { select: { name: 'Yours' } },
    }))

    expect(path).toEqual({
      id: 'path-1',
      label: 'A → B',
      fromId: 'thing-a',
      toId: 'thing-b',
      why: 'Both about where control actually lives.',
      made: '2026-06-01',
      origin: 'Yours',
    })
  })

  it('defaults a bare page — no from/to, no origin', () => {
    const path = toPath(fakePage({ Label: { title: [{ plain_text: 'Untitled' }] } }))
    expect(path.fromId).toBeNull()
    expect(path.toId).toBeNull()
    expect(path.origin).toBeNull()
  })
})

describe('toNotionPathProps', () => {
  it('round-trips through toPath', () => {
    const original = {
      id: 'path-1',
      label: 'A → B',
      fromId: 'thing-a',
      toId: 'thing-b',
      why: 'Both about where control actually lives.',
      made: '2026-06-01',
      origin: 'Yours' as const,
    }
    const notionProps = echoPlainText(toNotionPathProps(original))
    const roundtripped = toPath(fakePage(notionProps, original.id))
    expect(roundtripped).toEqual(original)
  })
})

describe('patchPathProps', () => {
  it('a Why-only patch writes ONLY Why — never touches From/To/Made/Origin', () => {
    const props = patchPathProps({ why: 'A better reason.' })
    expect(Object.keys(props)).toEqual(['Why'])
  })

  it('an empty patch writes nothing', () => {
    expect(patchPathProps({})).toEqual({})
  })
})
