import { describe, expect, it } from 'vitest'
import { glossPieces, sentenceAround, termMark } from './glossary'

describe('words on tap', () => {
  it('marks each term once per passage, the longer term first, in the passage’s own case', () => {
    const pieces = glossPieces('A passacaglia over a ground bass; the Passacaglia returns, then sonata form, col legno strings.')
    expect(pieces.filter((p) => typeof p !== 'string')).toEqual([
      { term: 'passacaglia', text: 'passacaglia' },
      { term: 'ground bass', text: 'ground bass' },
      { term: 'sonata form', text: 'sonata form' },
      { term: 'col legno', text: 'col legno' },
    ])
    // Nothing lost: the pieces put back together are the passage.
    expect(pieces.map((p) => (typeof p === 'string' ? p : p.text)).join('')).toBe('A passacaglia over a ground bass; the Passacaglia returns, then sonata form, col legno strings.')
  })

  it('leaves everyday words and words inside other words alone', () => {
    expect(glossPieces('In March the development of his style made the tempo grave.')).toEqual(['In March the development of his style made the tempo grave.'])
    expect(glossPieces('Codas and recodable')).toEqual(['Codas and recodable'])
  })

  it('gives the curator the sentence it was tapped in, and keys a definition by term and language', () => {
    expect(sentenceAround('First things. Then a fugue begins. After.', 'fugue')).toBe('Then a fugue begins.')
    expect(termMark('Col Legno', 'ro')).toBe('term:ro:col legno')
  })
})
