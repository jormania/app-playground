import { describe, it, expect } from 'vitest'
import { titleLeakWords, scenarioLeaksTitle } from './leakCheck'

describe('titleLeakWords', () => {
  it('keeps distinctive words and drops function words', () => {
    expect(titleLeakWords('Conceal Your Intentions')).toEqual(['conceal', 'intentions'])
  })

  it('dedupes and ignores short/common words', () => {
    // "Do Not Commit to Anyone" — only "commit" and "anyone" are distinctive
    expect(titleLeakWords('Do Not Commit to Anyone').sort()).toEqual(['anyone', 'commit'])
  })
})

describe('scenarioLeaksTitle', () => {
  it('flags a title word and its inflections', () => {
    expect(scenarioLeaksTitle('He commits to no one', 'Do Not Commit to Anyone')).toContain('commit')
    expect(scenarioLeaksTitle('She stopped early', 'Learn When to Stop')).toContain('stop')
  })

  it('is clean when no distinctive word appears', () => {
    expect(scenarioLeaksTitle('She hid how much she wanted the house', 'Conceal Your Intentions')).toEqual([])
  })

  it('does not flag function words shared with the title', () => {
    expect(scenarioLeaksTitle('You do not know who is watching', 'Do Not Commit to Anyone')).toEqual([])
  })
})
