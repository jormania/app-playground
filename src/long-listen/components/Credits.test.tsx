// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { creditRows, programmeCreditRows } from './Credits'
import { Traits, traitsOf } from './Traits'

afterEach(cleanup)

describe('a stand-in’s performers', () => {
  // The curator filled orchestra and ensemble both with the Berlin Philharmonic (29 October 2026).
  it('names an orchestra once when the ensemble is the same band', () => {
    const r = { orchestra: 'Berlin Philharmonic', ensemble: 'Berliner Philharmoniker', conductor: 'Jonathan Nott', soloists: [] }
    expect(programmeCreditRows(r)).toEqual([['Berlin Philharmonic', ''], ['Jonathan Nott', 'conductor']])
    expect(creditRows(r).map(([role]) => role)).toEqual(['conductor', 'orchestra'])
  })

  it('keeps an ensemble that is another group', () => {
    const r = { orchestra: 'London Symphony Orchestra', ensemble: 'Monteverdi Choir', soloists: [] }
    expect(programmeCreditRows(r).map(([name]) => name)).toEqual(['London Symphony Orchestra', 'Monteverdi Choir'])
  })
})

describe('the playing', () => {
  it('sets a few words as tags', () => {
    const { container } = render(<Traits label="The playing" words="warm, expansive" />)
    expect([...container.querySelectorAll('span')].map((n) => n.textContent)).toEqual(['The playing', 'warm', 'expansive'])
  })

  it('takes a sentence’s short opening words as its tags, and leaves the rest', () => {
    const words = 'Warm, velvety and fluid; a rich blended orchestral sound in which the transitions glow'
    const { container } = render(<Traits label="The playing" words={words} />)
    expect([...container.querySelectorAll('span')].map((n) => n.textContent)).toEqual(['The playing', 'warm', 'velvety and fluid'])
    expect(traitsOf('rich, deep-piled and luminous, with the Berliners’ string sound blooming slowly').tags).toEqual(['rich', 'deep-piled and luminous'])
  })

  it('says a sentence with no short opening as written', () => {
    const words = 'a rich blended orchestral sound in which the transitions glow'
    const { container } = render(<Traits label="The playing" words={words} />)
    expect(container.querySelector('em')?.textContent).toBe(words)
  })
})
