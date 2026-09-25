import { en, type StringKey } from './en'
import { ro } from './ro'
import type { Language, NoteNames } from '../profiles'

export type { StringKey }

const catalogs: Record<Language, Record<StringKey, string>> = { en, ro }

/**
 * Which plural form a number takes, as an index into a `{count|…}` token's forms.
 * English: one · other. Romanian (CLDR): one (1) · few (0, 2–19, and any number
 * ending in 01–19 above 100) · other (20 and up, which takes "de": 25 de note).
 */
export function pluralIndex(lang: Language, n: number): number {
  if (n === 1) return 0
  if (lang === 'en') return 1
  const r = n % 100
  return n === 0 || (r >= 1 && r <= 19) ? 1 : 2
}

/**
 * Look up a string and fill it. `{name}` is replaced by its value.
 * `{count|# note|# notes}` picks a form by the number in `count` (see
 * pluralIndex) and puts the number where `#` is; a form without `#` is used
 * as written ("o dată"). A missing form falls back to the last one.
 * Falls back to English, then to the key.
 */
export function translate(lang: Language, key: StringKey, vars: Record<string, string | number> = {}): string {
  const template = catalogs[lang][key] ?? en[key] ?? key
  const catalogLang: Language = catalogs[lang][key] ? lang : 'en'
  return template
    .replace(/\{(\w+)\|([^}]*)\}/g, (m, name: string, forms: string) => {
      if (!(name in vars)) return m
      const n = Number(vars[name])
      const list = forms.split('|')
      const form = list[Math.min(pluralIndex(catalogLang, n), list.length - 1)]
      return form.replace(/#/g, String(vars[name]))
    })
    .replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m))
}

const LETTERS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const SOLFEGE = ['Do', 'Do♯', 'Re', 'Re♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si']

/**
 * A key's name as this profile wants to read it. Octave numbers stay off: the
 * tutor shows where a key is on the keyboard, and "C4" vs Yamaha's "C3" is
 * exactly the confusion to spare a beginner (KEYPATH.md §4).
 */
export function noteLabel(pitch: number, names: NoteNames, lang: Language): string {
  const pc = ((pitch % 12) + 12) % 12
  const scheme = names === 'auto' ? (lang === 'ro' ? 'solfege' : 'letters') : names
  if (scheme === 'letters') return LETTERS[pc]
  if (scheme === 'solfege') return SOLFEGE[pc]
  return `${LETTERS[pc]} / ${SOLFEGE[pc]}`
}
