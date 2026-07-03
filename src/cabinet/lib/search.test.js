import { describe, it, expect } from 'vitest'
import { matchesSearch } from './search'

const app = { title: 'Touch Grass', tags: ['outdoor', 'react', 'vite'] }

describe('matchesSearch', () => {
  it('matches everything on an empty query', () => {
    expect(matchesSearch(app, '')).toBe(true)
    expect(matchesSearch(app, '   ')).toBe(true)
  })

  it('matches a substring of the title, case-insensitively', () => {
    expect(matchesSearch(app, 'grass')).toBe(true)
    expect(matchesSearch(app, 'TOUCH')).toBe(true)
  })

  it('matches a substring of a tag, case-insensitively', () => {
    expect(matchesSearch(app, 'outd')).toBe(true)
    expect(matchesSearch(app, 'REACT')).toBe(true)
  })

  it('does not match description text', () => {
    const withDescription = { ...app, description: 'a tarot card with a rare eldritch find' }
    expect(matchesSearch(withDescription, 'eldritch')).toBe(false)
  })

  it('does not match unrelated text', () => {
    expect(matchesSearch(app, 'kettlebell')).toBe(false)
  })

  it('handles apps with no tags', () => {
    expect(matchesSearch({ title: 'Codex Alchymicus' }, 'codex')).toBe(true)
  })
})
