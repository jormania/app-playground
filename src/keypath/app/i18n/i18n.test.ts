import { describe, expect, it } from 'vitest'
import { en } from './en'
import { ro } from './ro'
import { noteLabel, translate } from '.'

describe('translations', () => {
  it('has every English string in Romanian, with the same {placeholders}', () => {
    const vars = (s: string) => [...s.matchAll(/\{(\w+)(?:\|[^}]*)?\}/g)].map((m) => m[1]).sort()
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(ro[key], key).toBeTruthy()
      expect(vars(ro[key]), key).toEqual(vars(en[key]))
    }
  })

  it('counts in the right form: 1 note, 5 notes; o notă, 5 note, 25 de note', () => {
    expect(translate('en', 'notesCount', { count: 1 })).toBe('1 note')
    expect(translate('en', 'notesCount', { count: 5 })).toBe('5 notes')
    expect(translate('ro', 'notesCount', { count: 1 })).toBe('o notă')
    expect(translate('ro', 'notesCount', { count: 5 })).toBe('5 note')
    expect(translate('ro', 'notesCount', { count: 25 })).toBe('25 de note')
    expect(translate('ro', 'notesCount', { count: 101 })).toBe('101 note')
    expect(translate('ro', 'pCameBack', { count: 1 })).toBe('A revenit a doua zi: o dată')
    expect(translate('ro', 'pCameBack', { count: 3 })).toBe('A revenit a doua zi: de 3 ori')
    expect(translate('ro', 'pCameBack', { count: 21 })).toBe('A revenit a doua zi: de 21 de ori')
  })

  it('writes every count token with a form for each plural the language has', () => {
    const tokens = (s: string) => [...s.matchAll(/\{\w+\|([^}]*)\}/g)].map((m) => m[1].split('|').length)
    for (const s of Object.values(en)) for (const n of tokens(s)) expect(n, s).toBe(2)
    for (const s of Object.values(ro)) for (const n of tokens(s)) expect(n, s).toBe(3)
  })

  it('fills placeholders', () => {
    expect(translate('en', 'hello', { name: 'Nora' })).toBe('Hi, Nora!')
    expect(translate('ro', 'hello', { name: 'Nora' })).toBe('Salut, Nora!')
  })
})

describe('noteLabel', () => {
  it('follows the language by default: C D E in English, Do Re Mi in Romanian', () => {
    expect(noteLabel(60, 'auto', 'en')).toBe('C')
    expect(noteLabel(60, 'auto', 'ro')).toBe('Do')
    expect(noteLabel(67, 'auto', 'ro')).toBe('Sol')
  })

  it('can be set either way regardless of language, or show both', () => {
    expect(noteLabel(64, 'letters', 'ro')).toBe('E')
    expect(noteLabel(64, 'solfege', 'en')).toBe('Mi')
    expect(noteLabel(61, 'both', 'en')).toBe('C♯ / Do♯')
  })
})
