import { describe, expect, it } from 'vitest'
import { entryIdFromHash, findById, foldId, notionUrlForId } from './deeplink.js'

const ID = 'de3705a1d9e94c0fb1a7c5e2d0846f31'
const DASHED = 'de3705a1-d9e9-4c0f-b1a7-c5e2d0846f31'

describe('entryIdFromHash', () => {
  it('reads a bare or dashed id out of the entry hash', () => {
    expect(entryIdFromHash(`#/entry/${ID}`)).toBe(ID)
    expect(entryIdFromHash(`#/entry/${DASHED}`)).toBe(ID)
  })

  it('ignores anything that is not an entry link', () => {
    for (const hash of ['', '#', '#photos', '#/entry/', '#/entry/nope', '/entry/' + ID, null, undefined]) {
      expect(entryIdFromHash(hash), String(hash)).toBeNull()
    }
  })

  it('ignores an id of the wrong length rather than guessing at it', () => {
    expect(entryIdFromHash(`#/entry/${ID.slice(0, 31)}`)).toBeNull()
    expect(entryIdFromHash(`#/entry/${ID}ab`)).toBeNull()
  })

  it('is case-insensitive, since Notion is not consistent about it', () => {
    expect(entryIdFromHash(`#/entry/${ID.toUpperCase()}`)).toBe(ID)
  })
})

describe('findById', () => {
  const entries = [{ id: DASHED, name: 'Trio Nocturn' }, { id: 'ffff', name: 'other' }]

  it('matches a dashed stored id against a folded link id', () => {
    expect(findById(entries, ID)?.name).toBe('Trio Nocturn')
  })

  it('returns null for an id nothing carries, and for no id at all', () => {
    expect(findById(entries, '0'.repeat(32))).toBeNull()
    expect(findById(entries, null)).toBeNull()
    expect(findById([], ID)).toBeNull()
  })
})

describe('notionUrlForId', () => {
  it('points at the page itself — the one place a missing entry certainly exists', () => {
    expect(notionUrlForId(ID)).toBe(`https://www.notion.so/${ID}`)
    expect(notionUrlForId(null)).toBeNull()
  })
})

describe('foldId', () => {
  it('normalises both of Notion’s id spellings to one', () => {
    expect(foldId(DASHED)).toBe(foldId(ID))
    expect(foldId(null)).toBe('')
  })
})
