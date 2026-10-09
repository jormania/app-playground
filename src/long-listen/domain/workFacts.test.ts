import { describe, it, expect } from 'vitest'
import { catalogueLine, catalogueWords, whatAndWhen, compactFacts } from './workFacts'

describe('catalogueWords', () => {
  it('names whose catalogue a prefix belongs to', () => {
    expect(catalogueWords('FS 76')).toBe('No. 76 in Nielsen’s catalogue (FS)')
    expect(catalogueWords('BWV 1048')).toBe('No. 1048 in Bach’s catalogue (BWV)')
    expect(catalogueWords('L. 109')).toBe('No. 109 in Debussy’s catalogue (L)')
    expect(catalogueWords('D 944')).toBe('No. 944 in Schubert’s catalogue (D)')
    expect(catalogueWords('Hob. I:104')).toBe('No. I:104 in Haydn’s catalogue (Hob)')
  })

  it('tells Mozart’s K. from Scarlatti’s Kk.', () => {
    expect(catalogueWords('K. 550')).toBe('No. 550 in Mozart’s catalogue (K)')
    expect(catalogueWords('Kk. 380')).toBe('No. 380 in Domenico Scarlatti’s catalogue (Kk)')
    expect(catalogueWords('K. 380', 'Domenico Scarlatti')).toBe('No. 380 in Domenico Scarlatti’s catalogue (K)')
  })

  it('says opus plainly, with a number within it', () => {
    expect(catalogueWords('Op. 29')).toBe('Opus 29')
    expect(catalogueWords('Op. 59 No. 2')).toBe('Opus 59, no. 2')
  })

  it('leaves an unknown prefix as it was given', () => {
    expect(catalogueWords('XYZ 12')).toBe('XYZ 12')
  })
})

describe('catalogueLine', () => {
  it('translates each reference in a list', () => {
    expect(catalogueLine('Op. 29, FS 76')).toBe('Opus 29 · No. 76 in Nielsen’s catalogue (FS)')
    expect(catalogueLine(undefined)).toBe('')
  })
})

describe('whatAndWhen', () => {
  const now = new Date('2026-10-09T12:00:00Z')

  it('says what it is and how long ago it was written', () => {
    expect(whatAndWhen('symphony', '1914–16', now)).toBe('Symphony · written 1914–16, about 110 years ago')
    expect(whatAndWhen('string orchestra piece with bell', '1977', now)).toBe('String orchestra piece with bell · written 1977, about 50 years ago')
    expect(whatAndWhen('song cycle', '2019', now)).toBe('Song cycle · written 2019, about 7 years ago')
  })

  it('shows only what it was given', () => {
    expect(whatAndWhen('symphony', undefined, now)).toBe('Symphony')
    expect(whatAndWhen(undefined, 'c. 1720', now)).toBe('written c. 1720, about 305 years ago')
    expect(whatAndWhen(undefined, 'unknown', now)).toBe('written unknown')
  })
})

describe('the compact line', () => {
  it('says what, which number and when, in one short line', () => {
    expect(compactFacts('symphony', 'Op. 34', '1911–15')).toBe('Symphony · Op. 34 · 1911–15')
    expect(compactFacts('tone poem', '', '1917')).toBe('Tone poem · 1917')
    expect(compactFacts(undefined, undefined, undefined)).toBe('')
  })
})
