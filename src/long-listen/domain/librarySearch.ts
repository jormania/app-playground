import type { Concert, ProposedRecording, Work } from './types'
import { creditLine, fold } from './identity'
import { whoPlays } from './concertSoloists'

export interface LibraryWork { work: Work; recordings: { proposed: ProposedRecording }[]; live: Concert[] }
export interface LibraryEntry<W extends LibraryWork = LibraryWork> { composer: string; works: W[] }

/**
 * The Library's search: a composer keeps all their works; otherwise a work
 * stays when its title, its catalogue number ("BWV 1043", "op. 29") or anyone
 * on one of its recordings matches — and, for a work heard live, the evening's
 * conductor, orchestra or the soloists who played in it. Folded, so "Dvorak"
 * finds Dvořák and "Bebeselea" finds Bebeșelea.
 */
export function searchLibrary<W extends LibraryWork, E extends LibraryEntry<W>>(entries: E[], q: string): E[] {
  const needle = fold(q)
  if (!needle) return entries
  const has = (s: string | undefined) => Boolean(s && fold(s).includes(needle))
  const liveMatches = (w: W) => w.live.some((c) => {
    const here = c.works.find((x) => x.workId === w.work.id)
    return has(c.conductor) || has(c.orchestra) || (here ? whoPlays(c, here) : c.soloists).some((x) => has(x.name))
  })
  return entries
    .map((e) => {
      if (has(e.composer)) return e
      const works = e.works.filter((w) => has(w.work.title) || has(w.work.catalogue) || w.recordings.some((r) => has(creditLine(r.proposed)) || has(r.proposed.catalogue)) || liveMatches(w))
      return works.length ? { ...e, works } : null
    })
    .filter((e): e is E => Boolean(e))
}
