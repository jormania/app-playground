import { describe, it, expect } from 'vitest'
import { allWords, letterOf, mainTerm, searchWords, KINDS } from './dictionary'
import { GLOSSARY_TERMS } from './glossary'

describe('the dictionary', () => {
  const words = allWords()

  it('holds every term the notes underline, and each word once', () => {
    const terms = words.map((w) => w.term)
    // Every underlined term is here, as an entry or as another name of one ("english horn", with the cor anglais).
    const named = words.flatMap((w) => [w.term, ...w.aka])
    expect(GLOSSARY_TERMS.filter((t) => !named.includes(t))).toEqual([])
    expect(terms.filter((t, i) => terms.indexOf(t) !== i)).toEqual([])
    expect(named.filter((t, i) => named.indexOf(t) !== i)).toEqual([])
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

  it('lists a thing once, under one name, with its others beside it', () => {
    const corAnglais = words.find((w) => w.term === 'cor anglais')!
    expect(corAnglais.aka).toEqual(['english horn'])
    expect(words.find((w) => w.term === 'english horn')).toBeUndefined()
    expect(mainTerm('mute')).toBe('con sordino')
    expect(searchWords(words, 'english horn').map((w) => w.term)).toContain('cor anglais')
  })

  // 1 November 2026: the cor anglais and the english horn stood as two entries saying the same thing.
  it('has no two definitions that say nearly the same thing', () => {
    const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'in', 'to', 'for', 'with', 'its', 'it', 'is', 'as', 'by', 'on', 'that', 'from', 'listen', 'often', 'usually', 'music', 'piece'])
    const bag = (d: string) => new Set(d.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((x) => x.length > 2 && !STOP.has(x)))
    const close: string[] = []
    for (let i = 0; i < words.length; i++) for (let j = i + 1; j < words.length; j++) {
      const a = bag(words[i].definition), b = bag(words[j].definition)
      const shared = [...a].filter((x) => b.has(x)).length
      if (shared / Math.min(a.size, b.size) > 0.6) close.push(`${words[i].term} / ${words[j].term}`)
    }
    expect(close).toEqual([])
  })
})
