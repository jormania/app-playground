import { describe, it, expect, beforeEach } from 'vitest'
import { sameWork, surname } from '../domain/identity'
import { Journey } from '../curation/journey'
import { Repo, memoryStore } from '../store/repo'
import { fakeCurator, item, themes, programme } from './journey-audit-helpers'

describe('audit: work identity', () => {
  it('a nickname in quotes and the same nickname in brackets are one work', () => {
    // The concert reader is told to write `Symphony No. 3 in A minor, "Scottish"`; the programme curator often brackets it.
    expect(sameWork(
      { composer: 'Felix Mendelssohn', title: 'Symphony No. 3 in A minor, "Scottish"' },
      { composer: 'Felix Mendelssohn', title: 'Symphony No. 3 in A minor (Scottish)' },
    )).toBe(true)
    expect(sameWork(
      { composer: 'Felix Mendelssohn', title: 'Symphony No. 3 in A minor, "Scottish"' },
      { composer: 'Felix Mendelssohn', title: 'Symphony No. 3 in A minor' },
    )).toBe(true)
  })

  it('a catalogue number written into the title is the same work as one given in the catalogue field', () => {
    expect(sameWork(
      { composer: 'Jean Sibelius', title: 'Symphony No. 5 in E-flat major, Op. 82' },
      { composer: 'Jean Sibelius', title: 'Symphony No. 5', catalogue: 'Op. 82' },
    )).toBe(true)
  })

  it('two numbered pieces sharing one opus are not one work (a false merge hides music)', () => {
    expect(sameWork(
      { composer: 'Antonín Dvořák', title: 'Slavonic Dance No. 1', catalogue: 'Op. 46' },
      { composer: 'Antonín Dvořák', title: 'Slavonic Dance No. 8', catalogue: 'Op. 46' },
    )).toBe(false)
  })

  it('a generational suffix is not a surname (Library files Johann Strauss II under "I")', () => {
    expect(surname('Johann Strauss II')).toBe('strauss')
    expect(surname('Johann Strauss Jr.')).toBe('strauss')
  })
})

describe('audit: a concert work and a programme work are one Work', () => {
  let repo: Repo
  beforeEach(() => { repo = new Repo(memoryStore()) })

  it('a concert typed as "Debussy — La mer" after the programme’s "Claude Debussy — La mer" joins the same Work', async () => {
    const c = fakeCurator({
      themes: () => themes(['A', 'B', 'C']),
      programme: () => programme('Colour', [item('Claude Debussy', 'La mer', 'Pierre Boulez', 'Cleveland Orchestra'), item('Maurice Ravel', 'Boléro', 'Pierre Boulez', 'Berliner Philharmoniker')]),
    })
    const clock = new Date('2026-10-08T09:00:00Z')
    const j = new Journey(repo, c.client, { now: () => clock })
    const w = await j.ensureWeek()
    await j.choose(w.optionIds[0])
    const p = (await repo.programmes.all())[0]
    const laMer = p.sections.flatMap((s) => s.items).find((i) => i.proposed.work === 'La mer')!
    const kept = await j.saveConcert({ venue: 'Ateneul Român', date: '2026-10-09', soloists: [], works: [{ composer: 'Debussy', title: 'La mer' }], source: 'typed' })
    expect(kept.works[0].workId).toBe(laMer.workId)
  })
})
