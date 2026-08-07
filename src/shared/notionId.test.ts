import { describe, it, expect } from 'vitest'
import { parseNotionId } from './notionId.ts'

const ID = '0123456789abcdef0123456789abcdef'

describe('parseNotionId', () => {
  it('passes a bare 32-char id through, lowercased', () => {
    expect(parseNotionId(ID)).toBe(ID)
    expect(parseNotionId(ID.toUpperCase())).toBe(ID)
  })

  it('reads a dashed UUID', () => {
    expect(parseNotionId('01234567-89ab-cdef-0123-456789abcdef')).toBe(ID)
  })

  it('reads a plain Notion URL', () => {
    expect(parseNotionId(`https://notion.so/${ID}`)).toBe(ID)
    expect(parseNotionId(`https://www.notion.so/workspace/${ID}`)).toBe(ID)
  })

  it('reads a slug URL, where the id trails the title', () => {
    expect(parseNotionId(`https://notion.so/me/Fit-Check-Garments-${ID}`)).toBe(ID)
  })

  it('ignores a ?v= view id rather than mistaking it for the database', () => {
    // Notion's "Copy link" on a database view carries BOTH ids. Taking the
    // wrong one produces a valid-looking id that queries nothing.
    expect(parseNotionId(`https://notion.so/me/Garments-${ID}?v=ffffffffffffffffffffffffffffffff`))
      .toBe(ID)
  })

  it('ignores a # fragment', () => {
    expect(parseNotionId(`https://notion.so/${ID}#block`)).toBe(ID)
  })

  it('trims incidental whitespace from a paste', () => {
    expect(parseNotionId(`  https://notion.so/${ID}  `)).toBe(ID)
  })

  it('handles the app.notion.com host the Starter Template links use', () => {
    expect(parseNotionId(`https://app.notion.com/p/${ID}`)).toBe(ID)
  })

  it('returns empty for anything without an id, rather than throwing', () => {
    for (const junk of ['', '   ', null, undefined, 'https://notion.so/', 'not an id', 'abc123']) {
      expect(parseNotionId(junk as string)).toBe('')
    }
  })

  it('does not accept a too-short or too-long hex run', () => {
    expect(parseNotionId('0123456789abcdef')).toBe('')
    expect(parseNotionId(ID + 'ff')).toBe('')
  })
})
