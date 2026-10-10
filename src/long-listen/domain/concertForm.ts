import type { ConcertDraft } from '../curation/journey'
import { fold } from './identity'
import { whoPlays } from './concertSoloists'

/**
 * The concert form's own state. A draft names who plays in each work by
 * name, which is right once kept but wrong while typing: a soloist renamed to
 * another's name became the same person (one chip, two rows), and every
 * work's list followed the rename, so a later change to either row rewrote
 * both. While the form is open each soloist row carries a local key that
 * never changes, the works point at keys, and names are put back only when
 * the concert is kept.
 */
export interface FormSoloist { key: string; name: string; instrument?: string }
export interface FormWork { composer: string; title: string; catalogue?: string; /** Keys of the soloists who play in it; absent when nobody said. */ soloists?: string[] }
export type ConcertFormState = Omit<ConcertDraft, 'soloists' | 'works'> & { soloists: FormSoloist[]; works: FormWork[] }

let counter = 0
/** A key for a soloist row: unique within the page, meaningless outside it. */
export const soloistKey = () => `s${++counter}`

/** The form's state for a draft (a kept concert, or what a screenshot was read into). */
export function toForm(draft: ConcertDraft, key: () => string = soloistKey): ConcertFormState {
  const soloists = draft.soloists.map((x) => ({ key: key(), name: x.name, ...(x.instrument !== undefined ? { instrument: x.instrument } : {}) }))
  // A name in a work's list is the first soloist row of that name; a name with no row drops out, as it would on keeping.
  const keyOf = (name: string) => soloists.find((x) => fold(x.name) === fold(name))?.key
  return {
    ...draft,
    soloists,
    works: draft.works.map(({ soloists: who, ...w }) => ({
      ...w,
      ...(who ? { soloists: [...new Set(who.map(keyOf).filter((k): k is string => Boolean(k)))] } : {}),
    })),
  }
}

/** Back to a draft for keeping: each work's soloists by the names their rows hold now. */
export function toDraft(form: ConcertFormState): ConcertDraft {
  const nameOf = new Map(form.soloists.map((x) => [x.key, x.name.trim()]))
  return {
    ...form,
    soloists: form.soloists.map(({ key: _k, ...x }) => x),
    works: form.works.map(({ soloists: keys, ...w }) => ({
      ...w,
      ...(keys ? { soloists: [...new Set(keys.map((k) => nameOf.get(k)).filter((n): n is string => Boolean(n)))] } : {}),
    })),
  }
}

/** The rows with a name: the only ones a work can be given. */
export const namedSoloists = (form: ConcertFormState) => form.soloists.filter((x) => x.name.trim())

/** Who plays in a work, by key: as said, or as judged from the titles until the listener says otherwise. */
export function playingKeys(form: ConcertFormState, w: FormWork): string[] {
  const named = namedSoloists(form)
  if (w.soloists) return w.soloists.filter((k) => named.some((x) => x.key === k))
  // Judged by the same rule as a kept concert's, over the rows themselves, so what comes back is rows.
  const judged = whoPlays({ soloists: named, works: form.works.map((x) => ({ title: x.title })) }, { title: w.title }) as FormSoloist[]
  return judged.map((x) => x.key)
}

/** Press a soloist's chip under work `i`: the work's list becomes explicit, with them in or out. */
export function toggleSoloist(form: ConcertFormState, i: number, key: string): ConcertFormState {
  const now = playingKeys(form, form.works[i])
  const next = now.includes(key) ? now.filter((k) => k !== key) : [...now, key]
  return { ...form, works: form.works.map((w, j) => (j === i ? { ...w, soloists: next } : w)) }
}

/** Remove a soloist's row, and them from every work they were marked in. */
export function removeSoloist(form: ConcertFormState, key: string): ConcertFormState {
  return {
    ...form,
    soloists: form.soloists.filter((x) => x.key !== key),
    works: form.works.map((w) => (w.soloists ? { ...w, soloists: w.soloists.filter((k) => k !== key) } : w)),
  }
}
