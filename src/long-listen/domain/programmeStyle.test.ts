import { describe, expect, it } from 'vitest'
import { clock, curly, listenForAt, movementNamedIn, movementTitles, partWords, primeMinutes, pullQuote, roman, romanValue } from './programmeStyle'

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

describe('following along', () => {
  it('reads numerals and clocks', () => {
    expect(['I', 'IV', 'IX', 'XII', 'x', ''].map(romanValue)).toEqual([1, 4, 9, 12, 10, 0])
    expect(clock(252_400)).toBe('4:12')
    expect(clock(5_000)).toBe('0:05')
  })

  it('ties "listen for" to movements only when the recording divides the work as the numerals expect', () => {
    expect(listenForAt(['I', '', 'III'], 3, 3)).toEqual([1, null, 3])
    // A numeral past the recording's tracks: the album divides the work otherwise — tie none.
    expect(listenForAt(['I', 'IV'], 2, 3)).toEqual([null, null])
    // Untagged (older programmes), or a work in one track: none.
    expect(listenForAt(undefined, 2, 3)).toEqual([null, null])
    expect(listenForAt(['I', 'II'], 2, 1)).toEqual([null, null])
  })
})

describe('typesetting', () => {
  it('turns straight quotes into a printer’s', () => {
    expect(curly('Symphony No. 7, "Angel of Light"')).toBe('Symphony No. 7, “Angel of Light”')
    expect(curly("Beethoven's 'Eroica'")).toBe('Beethoven’s ‘Eroica’')
    expect(curly('"Titan" (Hamburg version)')).toBe('“Titan” (Hamburg version)')
  })
})

describe('a point that names its movement', () => {
  it('reads the movement from the words, over the tag', () => {
    expect(movementNamedIn('the third movement\'s swans, where brass rise over a held string haze', 3)).toBe(3)
    expect(movementNamedIn('the calm, held-breath arrival of the finale', 4)).toBe(4)
    expect(movementNamedIn('the lone shorebird of the first movement', 3)).toBe(1)
    expect(movementNamedIn('how the first movement\'s theme comes back in the finale', 4)).toBeNull()
    expect(movementNamedIn('brass chorales that arrive like light', 4)).toBeNull()
    expect(movementNamedIn('the fifth movement', 4)).toBeNull()
    // Cantus arcticus, as it was tagged: the swans of the third movement under the first.
    expect(listenForAt(['I', 'I', 'III'], 3, 3, ['the lone shorebird of the first movement', 'the third movement\'s swans', 'the way the tape sets the tempo'])).toEqual([1, 3, 3])
    // Untagged, a point that names its movement is still placed.
    expect(listenForAt(undefined, 2, 4, ['brass chorales', 'the arrival of the finale'])).toEqual([null, 4])
  })
})
