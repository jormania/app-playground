import { describe, it, expect } from 'vitest'
import { sectionTitle } from './sections'

describe('sectionTitle', () => {
  it('keeps a heading that says something', () => {
    expect(sectionTitle({ heading: 'Quieter company', role: 'coda' })).toBe('Quieter company')
    expect(sectionTitle({ heading: 'Start here', role: 'start' })).toBe('Start here')
  })

  it('replaces a bare connective with what the section is for', () => {
    expect(sectionTitle({ heading: 'Then', role: 'then' })).toBe('Where it leads')
    expect(sectionTitle({ heading: 'Next', role: 'deeper' })).toBe('Go deeper')
    expect(sectionTitle({ heading: '', role: 'contrast' })).toBe('A change of light')
  })

  it('says where it leads when the role is the curator’s own', () => {
    expect(sectionTitle({ heading: 'Then', role: 'drift' })).toBe('Where it leads')
  })
})
