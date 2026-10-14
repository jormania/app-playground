import { describe, expect, it } from 'vitest'
import { draftFrom, goingKey, goingStage, whenWords, type Going } from './going'

const g = (date: string, over: Partial<Going> = {}): Going => ({
  key: 'k', markedAt: '2026-10-01T10:00:00Z', ...over,
  event: { venue: 'Sala Radio', title: 'Mahler 5', date, time: '19:00', hall: null },
})

describe('before and after a concert', () => {
  it('keys a concert by date, venue and title, folded', () => {
    expect(goingKey({ date: '2026-10-23', venue: 'Filarmonica George Enescu', title: 'Brahms & Sibelius!' })).toBe('2026-10-23~filarmonica-george-enescu~brahms-sibelius')
    // A matinee and an evening, or two halls, on one day: two concerts.
    const evening = goingKey({ date: '2026-10-23', venue: 'Sala Radio', hall: 'Studioul', time: '19:00', title: 'Bach' })
    expect(evening).toBe('2026-10-23T1900~sala-radio-studioul~bach')
    expect(goingKey({ date: '2026-10-23', venue: 'Sala Radio', hall: 'Studioul', time: '11:00', title: 'Bach' })).not.toBe(evening)
  })

  it('offers the preparation in the week before, the entry after, nothing once kept or long past', () => {
    expect(goingStage(g('2026-10-30'), '2026-10-14')).toBe('later')
    expect(goingStage(g('2026-10-21'), '2026-10-14')).toBe('ahead')
    expect(goingStage(g('2026-10-14'), '2026-10-14')).toBe('ahead')
    expect(goingStage(g('2026-10-13'), '2026-10-14')).toBe('after')
    expect(goingStage(g('2026-10-13', { concertId: 'c' }), '2026-10-14')).toBe('done')
    expect(goingStage(g('2026-09-01'), '2026-10-14')).toBe('done')
  })

  it('says when as a person would', () => {
    expect(whenWords('2026-10-14', '2026-10-14')).toBe('tonight')
    expect(whenWords('2026-10-15', '2026-10-14')).toBe('tomorrow')
    expect(whenWords('2026-10-16', '2026-10-14')).toBe('on Friday')
    expect(whenWords('2026-10-30', '2026-10-14')).toBe('on 30 October')
  })

  it('fills the entry from the listing, and the works from the preparation when there is one', () => {
    expect(draftFrom(g('2026-10-13'))).toEqual({ venue: 'Sala Radio', date: '2026-10-13', time: '19:00', soloists: [], works: [{ composer: '', title: '' }], source: 'typed' })
    const d = draftFrom(g('2026-10-13'), { intro: '', inTheHall: '', conductor: 'Cristian Măcelaru', soloists: [], works: [{ composer: 'Gustav Mahler', title: 'Symphony No. 5', soloists: [], about: '', listenFor: '' }] })
    expect(d).toMatchObject({ conductor: 'Cristian Măcelaru', works: [{ composer: 'Gustav Mahler', title: 'Symphony No. 5', soloists: [] }] })
  })
})
