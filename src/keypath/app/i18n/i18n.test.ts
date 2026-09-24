import { describe, expect, it } from 'vitest'
import { en } from './en'
import { ro } from './ro'
import { noteLabel, translate } from '.'

describe('translations', () => {
  it('has every English string in Romanian, with the same {placeholders}', () => {
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(ro[key], key).toBeTruthy()
      expect(vars(ro[key]), key).toEqual(vars(en[key]))
    }
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
