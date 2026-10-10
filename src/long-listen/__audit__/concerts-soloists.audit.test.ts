import { describe, it, expect } from 'vitest'
import { whoPlays } from '../domain/concertSoloists'

type W = { title: string; soloists?: string[] }
const names = (c: { soloists: { name: string; instrument?: string }[]; works: W[] }, w: W) => whoPlays(c, w).map((x) => x.name)

describe('audit: soloists per work at a concert', () => {
  // The form (screens/Concerts.tsx `toggle`) materialises ONE work's judged list when a chip is pressed.
  // That must not change what is judged for the other works the listener said nothing about.
  it('a recital: marking who plays in one song does not take the soloists off every other song', () => {
    const soloists = [{ name: 'Anna Prohaska', instrument: 'soprano' }, { name: 'Eric Schneider', instrument: 'piano' }]
    const before = { soloists, works: [{ title: 'Ave Maria' }, { title: 'Frauenliebe und -leben' }, { title: 'Wesendonck Lieder' }] as W[] }
    expect(names(before, before.works[1])).toEqual(['Anna Prohaska', 'Eric Schneider'])
    // The listener unticks the pianist on the first song (it was sung unaccompanied).
    const after = { soloists, works: [{ title: 'Ave Maria', soloists: ['Anna Prohaska'] }, { title: 'Frauenliebe und -leben' }, { title: 'Wesendonck Lieder' }] as W[] }
    expect(names(after, after.works[1])).toEqual(['Anna Prohaska', 'Eric Schneider'])
    expect(names(after, after.works[2])).toEqual(['Anna Prohaska', 'Eric Schneider'])
  })

  it('"Concerto for Two Violins" goes to the violinists, not the evening’s pianist too', () => {
    const c = {
      soloists: [{ name: 'Alina Ibragimova', instrument: 'violin' }, { name: 'Vilde Frang', instrument: 'violin' }, { name: 'András Schiff', instrument: 'piano' }],
      works: [{ title: 'Concerto for Two Violins in D minor' }, { title: 'Keyboard Concerto No. 1 in D minor' }] as W[],
    }
    expect(names(c, c.works[0])).toEqual(['Alina Ibragimova', 'Vilde Frang'])
  })

  it('"Concerto for Two Pianos" goes to the pianists, not the cellist too', () => {
    const c = {
      soloists: [{ name: 'Katia Labèque', instrument: 'piano' }, { name: 'Marielle Labèque', instrument: 'piano' }, { name: 'Sol Gabetta', instrument: 'cello' }],
      works: [{ title: 'Concerto for Two Pianos in D minor' }, { title: 'Cello Concerto No. 1' }] as W[],
    }
    expect(names(c, c.works[0])).toEqual(['Katia Labèque', 'Marielle Labèque'])
  })
})
