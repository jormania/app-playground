/**
 * The understory, gathered by where things came from.
 *
 * A Kobo import lands a whole season's reading at once — hundreds of rows in
 * one flat, fading list, where a passage you marked in March sits between two
 * others from the same page and nothing tells you which book you are in. The
 * nursery is where you decide what to keep, and deciding needs the rows to be
 * legible as *this book, these lines*.
 *
 * Grouping is presentation only: it changes no field, sets no source, and
 * reorders nothing within a group. And it only happens when there is
 * something to group by — a nursery holding only typed captures renders
 * exactly the flat list it always did, because a heading over a single
 * untitled section is noise.
 */
import type { Thing } from './notion'
import type { Source } from './sources'

export interface NurseryGroup {
  /** Null for the section of things with no source — always first: they are
   *  your own recent captures, and the reason you opened the nursery. */
  source: Source | null
  things: Thing[]
}

/**
 * Sections in the order they should be read, or a single unheaded section
 * when nothing here has a source.
 *
 * Sourced sections follow the order the things themselves arrive in (the
 * caller's list is newest-first), so the book you have just imported is the
 * one you land on.
 */
export function groupNurseryBySource(things: Thing[], sources: Source[]): NurseryGroup[] {
  const hasAnySource = things.some((t) => t.sourceId && sources.some((s) => s.id === t.sourceId))
  if (!hasAnySource) return [{ source: null, things }]

  const sourceById = new Map(sources.map((s) => [s.id, s]))
  const unsourced: Thing[] = []
  const bySource = new Map<string, Thing[]>()

  for (const thing of things) {
    const source = thing.sourceId ? sourceById.get(thing.sourceId) : undefined
    if (!source) {
      // Includes a thing pointing at a source that isn't loaded — better an
      // unheaded row than a section titled with an id.
      unsourced.push(thing)
      continue
    }
    const existing = bySource.get(source.id)
    if (existing) existing.push(thing)
    else bySource.set(source.id, [thing])
  }

  const groups: NurseryGroup[] = []
  if (unsourced.length > 0) groups.push({ source: null, things: unsourced })
  for (const [id, grouped] of bySource) {
    groups.push({ source: sourceById.get(id) as Source, things: grouped })
  }
  return groups
}
