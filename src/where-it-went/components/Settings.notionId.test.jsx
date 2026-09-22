import { describe, it, expect } from 'vitest'
import { extractNotionId } from './Settings.jsx'
import { parseNotionId } from '../../shared/notionId.ts'

// WhereItWent normalises its six database-ID fields with its own parser rather
// than the shared one. R-019 asked whether that should be reconciled; the answer
// was no, and these tests are the record of why. Each case below is a place the
// two disagree, and each disagreement reaches localStorage.
//
// If a future pass swaps extractNotionId for parseNotionId, these fail — which is
// the point. They are not asserting the shared parser is wrong.
const ID = '41c42bc4dfb543f49051810b3c5880fe'
const DASHED = '41c42bc4-dfb5-43f4-9051-810b3c5880fe'

describe('extractNotionId is deliberately not parseNotionId', () => {
  it('keeps the dashes where the shared parser strips them', () => {
    expect(extractNotionId(DASHED)).toBe(DASHED)
    expect(parseNotionId(DASHED)).toBe(ID)
  })

  it('preserves case where the shared parser lowercases', () => {
    const upper = DASHED.toUpperCase()
    expect(extractNotionId(upper)).toBe(upper)
    expect(parseNotionId(upper)).toBe(ID)
  })

  it('returns the input unchanged when nothing is id-shaped, where the shared parser returns empty', () => {
    // The load-bearing difference. App.jsx gates on
    // `!!config.token && !!config.transactionsDb`, so '' means "not configured
    // yet" and a bad string means "configured, and Notion will say no". Those
    // are different screens, and only one of them keeps what the user typed.
    expect(extractNotionId('  not an id  ')).toBe('not an id')
    expect(parseNotionId('  not an id  ')).toBe('')
  })

  it('agrees with the shared parser on a bare lowercase id, which is the common case', () => {
    expect(extractNotionId(ID)).toBe(ID)
    expect(parseNotionId(ID)).toBe(ID)
  })

  it('pulls the id out of a pasted URL, as the shared parser does', () => {
    const url = `https://www.notion.so/me/Spending-${ID}?v=abc123`
    expect(extractNotionId(url)).toBe(ID)
    expect(parseNotionId(url)).toBe(ID)
  })

  it('treats empty and nullish input the same way in both', () => {
    for (const empty of [null, undefined, '']) {
      expect(extractNotionId(empty)).toBe('')
      expect(parseNotionId(empty)).toBe('')
    }
  })
})
