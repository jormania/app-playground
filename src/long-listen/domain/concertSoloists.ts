import type { Concert } from './types'
import { fold } from './identity'
import { needsSoloists } from '../curator/validate'

type Soloist = Concert['soloists'][number]
type ConcertWork = Pick<Concert['works'][number], 'title' | 'soloists'>
type Evening = { soloists: Soloist[]; works: ConcertWork[] }

const INSTRUMENTS: [RegExp, string][] = [
  [/\bviolin\b/, 'violin'], [/\bviola\b/, 'viola'], [/\b(cello|violoncello)\b/, 'cello'], [/\bpiano\b/, 'piano'],
  [/\bflute\b/, 'flute'], [/\boboe\b/, 'oboe'], [/\bclarinet\b/, 'clarinet'], [/\bbassoon\b/, 'bassoon'], [/\bhorn\b/, 'horn'],
  [/\btrumpet\b/, 'trumpet'], [/\btrombone\b/, 'trombone'], [/\bharp\b/, 'harp'], [/\bguitar\b/, 'guitar'], [/\borgan\b/, 'organ'],
  [/\bsaxophone\b/, 'saxophone'], [/\bdouble bass\b/, 'double bass'],
]

/** The instruments a work's title gives a solo part to: "Cello Concerto" → cello. */
function instrumentsIn(title: string): string[] {
  const t = title.toLowerCase()
  return INSTRUMENTS.filter(([re]) => re.test(t)).map(([, name]) => name)
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
  if (!c.works.some((x) => !x.soloists && needsSoloists(x.title))) return c.works.every((x) => !x.soloists) ? c.soloists : []
  if (!needsSoloists(w.title)) return []
  const named = instrumentsIn(w.title)
  const playing = named.length ? c.soloists.filter((x) => x.instrument && named.some((n) => fold(x.instrument!).includes(n))) : []
  return playing.length ? playing : c.soloists
}

/** The soloists no work claims: shown with the evening, so nobody named on the programme goes missing. */
export function unplaced(c: Evening): Soloist[] {
  const placed = new Set(c.works.flatMap((w) => whoPlays(c, w).map((x) => fold(x.name))))
  return c.soloists.filter((x) => !placed.has(fold(x.name)))
}
