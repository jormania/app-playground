import { describe, expect, it } from 'vitest'
import { movementTitles, partWords, primeMinutes, pullQuote, roman } from './programmeStyle'

describe('the programme’s conventions', () => {
  it('numbers parts in Roman numerals and names them in words', () => {
    expect([1, 2, 3, 4, 5, 9, 12].map(roman)).toEqual(['I', 'II', 'III', 'IV', 'V', 'IX', 'XII'])
    expect(partWords(2, 3)).toBe('The second part, of three')
    expect(partWords(1, 1)).toBe('The only part')
  })

  it('prints a duration as programmes do, and nothing when it isn’t known', () => {
    expect(primeMinutes(24 * 60000 + 20000)).toBe('c. 24′')
    expect(primeMinutes(20000)).toBe('c. 1′')
    expect(primeMinutes(undefined)).toBeUndefined()
  })

  it('lists movements without the work’s title in front, numbering any that lack it', () => {
    expect(movementTitles(['Symphony No. 2 in D Major, Op. 43: I. Allegretto', 'Symphony No. 2 in D Major, Op. 43: II. Tempo andante, ma rubato'])).toEqual([
      { numeral: 'I', title: 'Allegretto' },
      { numeral: 'II', title: 'Tempo andante, ma rubato' },
    ])
    expect(movementTitles(['De l’aube à midi sur la mer', 'Jeux de vagues', 'Dialogue du vent et de la mer'])).toEqual([
      { numeral: 'I', title: 'De l’aube à midi sur la mer' },
      { numeral: 'II', title: 'Jeux de vagues' },
      { numeral: 'III', title: 'Dialogue du vent et de la mer' },
    ])
    // Prefixes that differ aren't the work's title: the names stay whole.
    expect(movementTitles(['Prelude: Slow', 'Fugue: Fast']).map((m) => m.title)).toEqual(['Prelude: Slow', 'Fugue: Fast'])
    // One track is no list of movements.
    expect(movementTitles(['La mer'])).toEqual([])
    expect(movementTitles(undefined)).toEqual([])
  })

  it('pulls one whole sentence that reads at a glance, or none', () => {
    const quote = pullQuote([
      'Short one. Debussy never called it a symphony, but it moves like one, three panels of the same sea at different hours. It is long and it goes on for a very long time with many many words that keep coming one after the other until it is far too long to pull.',
    ])
    expect(quote).toBe('Debussy never called it a symphony, but it moves like one, three panels of the same sea at different hours.')
    expect(pullQuote(['Too short.', 'Also short here.'])).toBeUndefined()
  })
})
