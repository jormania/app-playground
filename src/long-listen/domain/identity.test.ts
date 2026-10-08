import { describe, it, expect } from 'vitest'
import { fold, sameWork, workTitleKey, recordingId, workId, performersKey, creditLine, surname } from './identity'

describe('identity of works', () => {
  it('folds accents, Polish ł and punctuation', () => {
    expect(fold('Lutosławski')).toBe('lutoslawski')
    expect(fold('Dvořák — Symphony “From the New World”')).toBe('dvorak symphony from the new world')
  })

  it('treats a title with and without its key as one work', () => {
    expect(workTitleKey('Symphony No. 5 in C-sharp minor')).toBe(workTitleKey('Symphony No. 5'))
    expect(sameWork(
      { composer: 'Gustav Mahler', title: 'Symphony No. 5 in C-sharp minor' },
      { composer: 'Gustav Mahler', title: 'Symphony no.5' },
    )).toBe(true)
  })

  it('matches on catalogue number when titles differ', () => {
    expect(sameWork(
      { composer: 'Ludwig van Beethoven', title: 'Symphony No. 3 "Eroica"', catalogue: 'Op. 55' },
      { composer: 'Ludwig van Beethoven', title: 'Eroica Symphony', catalogue: 'op.55' },
    )).toBe(true)
  })

  it('does not merge different works, composers or a movement with its symphony', () => {
    expect(sameWork({ composer: 'Gustav Mahler', title: 'Symphony No. 5' }, { composer: 'Gustav Mahler', title: 'Symphony No. 6' })).toBe(false)
    expect(sameWork({ composer: 'Richard Strauss', title: 'Don Juan' }, { composer: 'Johann Strauss II', title: 'Don Juan' })).toBe(false)
    expect(sameWork({ composer: 'Gustav Mahler', title: 'Symphony No. 5' }, { composer: 'Gustav Mahler', title: 'Symphony No. 5: Adagietto' })).toBe(false)
  })
})

describe('identity of recordings', () => {
  const mahler5 = workId('Gustav Mahler', 'Symphony No. 5')

  it('keeps two interpretations of one work apart', () => {
    const bernstein = recordingId(mahler5, { conductor: 'Leonard Bernstein', orchestra: 'Wiener Philharmoniker', soloists: [] })
    const boulez = recordingId(mahler5, { conductor: 'Pierre Boulez', orchestra: 'Wiener Philharmoniker', soloists: [] })
    expect(bernstein).not.toBe(boulez)
    expect(bernstein.startsWith('rec:gustav-mahler:symphony-5')).toBe(true)
  })

  it('is the same recording whatever order soloists are named in', () => {
    const a = performersKey({ conductor: 'X', orchestra: 'Y', soloists: [{ name: 'Anne' }, { name: 'Bo' }] })
    const b = performersKey({ conductor: 'X', orchestra: 'Y', soloists: [{ name: 'Bo' }, { name: 'Anne' }] })
    expect(a).toBe(b)
  })

  it('writes a credit line and finds surnames', () => {
    expect(creditLine({ conductor: 'Pierre Boulez', orchestra: 'Cleveland Orchestra', soloists: [] })).toBe('Pierre Boulez · Cleveland Orchestra')
    expect(creditLine({ ensemble: 'Ensemble intercontemporain', soloists: [{ name: 'Hilary Hahn' }] })).toBe('Hilary Hahn · Ensemble intercontemporain')
    expect(surname('Esa-Pekka Salonen')).toBe('salonen')
  })
})
