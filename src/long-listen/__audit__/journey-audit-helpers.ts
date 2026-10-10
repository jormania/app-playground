// Shared fixtures for the audit scenario tests (modelled on curation/journey.test.ts).
import type { CuratorClient, CuratedItem, ProgrammeResponse, ThemesResponse } from '../curation/api'

export function fakeCurator(script: Partial<Record<string, (payload: any, n: number) => unknown>>) {
  const calls: { op: string; payload: any }[] = []
  const client: CuratorClient = {
    async call<T>(op: string, payload: unknown): Promise<T> {
      calls.push({ op, payload })
      const fn = script[op]
      if (!fn) throw new Error(`unexpected curator call: ${op}`)
      return (await fn(payload, calls.filter((c) => c.op === op).length)) as T
    },
  }
  return { client, calls, count: (op: string) => calls.filter((c) => c.op === op).length }
}

export function deferred<T = void>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

export const tick = () => new Promise((r) => setTimeout(r, 0))

export const item = (composer: string, workTitle: string, conductor: string, orchestra: string): CuratedItem => ({
  composer, workTitle, conductor, orchestra, soloists: [], character: ['clear'], why: 'Because.', whyThisRecording: 'This one.', listenFor: ['the opening'],
})

export const themes = (titles: [string, string, string], returning?: { at: number; themeId: string }): ThemesResponse => ({
  options: (['immersive', 'curious', 'adventurous'] as const).map((mood, i) => ({
    mood, title: titles[i], pitch: `${titles[i]} pitch`, character: ['x'], why: 'why', angle: `${titles[i]} angle`,
    returning: returning?.at === i ? { themeId: returning.themeId, note: 'We first explored this earlier.' } : undefined,
  })),
  promptVersion: 'themes@test', model: 'm',
})

export const programme = (title: string, items: CuratedItem[]): ProgrammeResponse => ({
  programme: {
    title, dek: 'dek', introduction: 'intro', whyNow: 'now', historicalPlace: 'h', howTheyRelate: 'r',
    sections: [{ role: 'start', heading: 'Start here', items: items.slice(0, 1) }, { role: 'then', heading: 'Then', items: items.slice(1) }],
    comparisons: [],
  },
  removedRepeats: 0, promptVersion: 'programme@test', model: 'm',
})

export const FRENCH = [item('Claude Debussy', 'La mer', 'Pierre Boulez', 'Cleveland Orchestra'), item('Maurice Ravel', 'Daphnis et Chloé', 'Pierre Monteux', 'London Symphony Orchestra')]
export const MORE = [item('Albert Roussel', 'Bacchus et Ariane', 'Stéphane Denève', 'Royal Scottish National Orchestra'), item('Henri Dutilleux', 'Métaboles', 'George Szell', 'Cleveland Orchestra')]
export const EVENING = [item('Gabriel Fauré', 'Pelléas et Mélisande', 'Michel Plasson', 'Orchestre du Capitole de Toulouse'), item('Charles Koechlin', 'Les Bandar-log', 'Heinz Holliger', 'SWR Radio-Sinfonieorchester Stuttgart')]
export const OTHER = [item('Jean Sibelius', 'Tapiola', 'Osmo Vänskä', 'Lahti Symphony Orchestra'), item('Carl Nielsen', 'Symphony No. 4', 'Herbert Blomstedt', 'San Francisco Symphony')]
