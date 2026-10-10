import { describe, it, expect } from 'vitest'
import { unplaced, whoPlays } from './concertSoloists'

const evening = {
  soloists: [{ name: 'Alexandra Conunova', instrument: 'violin' }, { name: 'Andrei Ioniță', instrument: 'cello' }],
  works: [
    { title: 'Romanian Rhapsody No. 1' },
    { title: 'Double Concerto in A minor' },
    { title: 'Cello Concerto' },
    { title: 'Symphony No. 3 in A minor, "Scottish"' },
  ] as { title: string; soloists?: string[] }[],
}
const names = (w: { title: string; soloists?: string[] }) => whoPlays(evening, w).map((x) => x.name)

describe('who of the evening’s soloists plays in a work', () => {
  it('judges an older concert from its titles: none in the symphony, both in the double, the cellist in the cello concerto', () => {
    expect(names(evening.works[0])).toEqual([])
    expect(names(evening.works[1])).toEqual(['Alexandra Conunova', 'Andrei Ioniță'])
    expect(names(evening.works[2])).toEqual(['Andrei Ioniță'])
    expect(names(evening.works[3])).toEqual([])
    expect(unplaced(evening)).toEqual([])
  })
  it('follows what was said, per work, over any judgement', () => {
    expect(names({ title: 'Symphony No. 3', soloists: ['Andrei Ioniță'] })).toEqual(['Andrei Ioniță'])
    expect(names({ title: 'Double Concerto', soloists: [] })).toEqual([])
  })
  it('in an evening with no concerto (a recital, songs), has the soloists on every work', () => {
    const recital = { soloists: [{ name: 'Daniil Trifonov', instrument: 'piano' }], works: [{ title: 'Kreisleriana' }, { title: 'Sonata No. 2' }] }
    expect(whoPlays(recital, recital.works[1]).map((x) => x.name)).toEqual(['Daniil Trifonov'])
  })
})
