import { describe, it, expect } from 'vitest'
import { allWords, letterOf, searchWords, KINDS } from './dictionary'
import { GLOSSARY_TERMS } from './glossary'

describe('the dictionary', () => {
  const words = allWords()

  it('holds every term the notes underline, and each word once', () => {
    const terms = words.map((w) => w.term)
    expect(GLOSSARY_TERMS.filter((t) => !terms.includes(t))).toEqual([])
    expect(terms.filter((t, i) => terms.indexOf(t) !== i)).toEqual([])
    expect(words.filter((w) => w.inNotes).length).toBe(GLOSSARY_TERMS.length)
  })

  it('gives every word a definition of two sentences and about forty words at most, under a kind it offers', () => {
    const bad = words.filter((w) => !w.definition || w.definition.split(/\s+/).length > 45 || (w.definition.match(/[.!?](\s|$)/g) ?? []).length > 2 || !KINDS.includes(w.kind))
    expect(bad.map((w) => w.term)).toEqual([])
  })

  it('files words A to Z under their first letter, accents set aside', () => {
    expect(letterOf('ländler')).toBe('L')
    expect(letterOf('idée fixe')).toBe('I')
    const letters = words.map((w) => letterOf(w.term))
    expect(letters).toEqual([...letters].sort())
  })

  it('finds a word by its name or by what it does, accents and case aside', () => {
    expect(searchWords(words, 'LANDLER').map((w) => w.term)).toContain('ländler')
    expect(searchWords(words, 'wood bow').map((w) => w.term)).toContain('col legno')
    expect(searchWords(words, '  ')).toHaveLength(words.length)
  })
})
