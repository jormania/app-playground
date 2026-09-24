import { en, type StringKey } from './en'
import { ro } from './ro'
import type { Language, NoteNames } from '../profiles'

export type { StringKey }

const catalogs: Record<Language, Record<StringKey, string>> = { en, ro }

/** Look up a string and fill {placeholders}. Falls back to English, then to the key. */
export function translate(lang: Language, key: StringKey, vars: Record<string, string | number> = {}): string {
  const template = catalogs[lang][key] ?? en[key] ?? key
  return template.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m))
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
