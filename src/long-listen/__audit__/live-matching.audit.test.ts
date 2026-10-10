import { describe, it, expect } from 'vitest'
import { meet, whatIsOn } from '../live/live'
import type { ProgrammeItem } from '../domain/types'

const item = (composer: string, work: string, conductor?: string): ProgrammeItem => ({
  id: work, workId: work, recordingId: `r-${work}`, why: '', whyThisRecording: '', listenFor: [],
  proposed: { composer, work, conductor, soloists: [] },
})
const ev = (title: string, description = '') => ({ venue: 'Filarmonica George Enescu', title, date: '2026-11-14', description })

describe('audit: Live in Bucharest matching', () => {
  it('knows the very work when the programme title carries both its number and its opus, and the hall prints only the number', () => {
    // The existing test passes only because its title has no ", Op. 82"; the curator usually writes one.
    expect(meet(item('Jean Sibelius', 'Symphony No. 5 in E-flat major, Op. 82'), ev('Concert simfonic: Sibelius – Simfonia nr. 5'))).toBe('work')
    expect(meet(item('Franz Schubert', 'Symphony No. 8 in B minor, D. 759 "Unfinished"'), ev('Schubert – Simfonia nr. 8 „Neterminata”'))).toBe('work')
  })

  it('does not call it the very work because the day of the month in the description equals the symphony’s number', () => {
    expect(meet(item('Antonín Dvořák', 'Symphony No. 9'), ev('Dvořák: Concertul pentru violoncel', 'Joi, 9 octombrie 2026, ora 19:00'))).toBe('composer')
  })

  it('finds Johann Strauss II on the bill (his "surname" is not "ii")', () => {
    expect(meet(item('Johann Strauss II', 'An der schönen blauen Donau'), ev('Concert de Anul Nou: Strauss, valsuri și polci'))).toBe('composer')
  })

  it('names the composer by surname in the line', () => {
    const m = { item: item('Johann Strauss II', 'Kaiser-Walzer'), event: ev('Strauss: Kaiser-Walzer'), how: 'composer' as const }
    expect(whatIsOn(m)).toBe('music by Strauss')
  })
})
