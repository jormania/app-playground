import type { Concert } from './types'
import { fold } from './identity'
import { needsSoloists } from '../curator/validate'

type Soloist = Concert['soloists'][number]
type ConcertWork = Pick<Concert['works'][number], 'title' | 'soloists'>
type Evening = { soloists: Soloist[]; works: ConcertWork[] }

// Plurals count: "Concerto for Two Violins" names the violin as surely as
// "Violin Concerto" does. A horn is not the English horn, which is its own part.
const INSTRUMENTS: [RegExp, string][] = [
  [/\bviolins?\b/, 'violin'], [/\bviolas?\b/, 'viola'], [/\b(cellos?|violoncellos?)\b/, 'cello'], [/\bpianos?\b/, 'piano'],
  [/\bflutes?\b/, 'flute'], [/\boboes?\b/, 'oboe'], [/\bclarinets?\b/, 'clarinet'], [/\bbassoons?\b/, 'bassoon'],
  [/(?<!english )\bhorns?\b/, 'horn'], [/\b(english horns?|cor anglais)\b/, 'english horn'],
  [/\btrumpets?\b/, 'trumpet'], [/\btrombones?\b/, 'trombone'], [/\bharps?\b/, 'harp'], [/\bguitars?\b/, 'guitar'], [/\borgans?\b/, 'organ'],
  [/\bsaxophones?\b/, 'saxophone'], [/\bdouble bass(es)?\b/, 'double bass'],
]

/** The instruments a work's title gives a solo part to: "Cello Concerto" → cello. */
function instrumentsIn(title: string): string[] {
  const t = title.toLowerCase()
  return INSTRUMENTS.filter(([re]) => re.test(t)).map(([, name]) => name)
}

/** Whether a soloist's stated instrument is the one a title names ("English horn" is not "horn"). */
function plays(instrument: string, named: string): boolean {
  const own = fold(instrument)
  const englishHorn = /english horn|cor anglais/.test(own)
  if (named === 'horn' && englishHorn) return false
  return named === 'english horn' ? englishHorn : own.includes(named)
}

/**
 * Who of the evening's soloists plays in this work. A programme lists its
 * soloists once, but they seldom play everything: the cellist in the cello
 * concerto, both in the double concerto, neither in the symphony. Kept per
 * work when the reader or the listener said so; otherwise judged from the
 * titles — a work with no solo part has none, a concerto naming an
 * instrument has the soloists who play it, any other concerto has them all.
 * An evening where no work has a solo part (a recital, songs) has them on
 * every work, since nothing says otherwise.
 */
export function whoPlays(c: Evening, w: ConcertWork): Soloist[] {
  if (w.soloists) return w.soloists.map((name) => c.soloists.find((x) => fold(x.name) === fold(name)) ?? { name })
  if (!c.soloists.length) return []
  // Judged from every title, kept or not: the form keeps one work's list when
  // a chip is pressed, and that must not change what the other works are judged
  // to have. A recital stays a recital after one song is marked.
  if (!c.works.some((x) => needsSoloists(x.title))) return c.soloists
  if (!needsSoloists(w.title)) return []
  const named = instrumentsIn(w.title)
  if (!named.length) return c.soloists
  const playing = c.soloists.filter((x) => x.instrument && named.some((n) => plays(x.instrument!, n)))
  if (playing.length) return playing
  // Nobody listed plays the named instrument: someone whose instrument wasn't
  // given is likelier the one than the evening's other players.
  const unknown = c.soloists.filter((x) => !x.instrument)
  return unknown.length ? unknown : c.soloists
}

/** The soloists no work claims: shown with the evening, so nobody named on the programme goes missing. */
export function unplaced(c: Evening): Soloist[] {
  const placed = new Set(c.works.flatMap((w) => whoPlays(c, w).map((x) => fold(x.name))))
  return c.soloists.filter((x) => !placed.has(fold(x.name)))
}
