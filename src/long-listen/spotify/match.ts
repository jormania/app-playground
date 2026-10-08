import { fold, surname, workTitleKey } from '../domain/identity'
import type { ProposedRecording } from '../domain/types'

/**
 * Does a Spotify track carry the recording the curator proposed?
 *
 * This is the factual check behind every Spotify link in the app. The curator
 * names a work and its performers; Spotify returns tracks with a title and an
 * artist list. A track only counts if it is the right WORK *and* the right
 * PERFORMERS — "Beethoven 5" by anyone is not "Beethoven 5, Kleiber / Vienna".
 *
 *   strong   — work title matches and every named performer is credited
 *   probable — work matches, composer credited, and the conductor (or the first
 *              soloist, when there is no conductor) is credited
 *   none     — anything less; the UI says "not found on Spotify" rather than
 *              linking a different interpretation
 */
export interface SpotifyTrackLike {
  id: string
  name: string
  uri: string
  artists: { name: string; id?: string }[]
  album?: { id: string; name: string }
  track_number?: number
  disc_number?: number
}

export type MatchLevel = 'strong' | 'probable' | 'none'

// Orchestras are billed in several languages; fold the common variants together.
const ORCHESTRA_WORDS: [RegExp, string][] = [
  [/\bwiener\b/g, 'vienna'],
  [/\bberliner\b/g, 'berlin'],
  [/\bmunchner\b/g, 'munich'],
  [/\bphilharmoniker\b/g, 'philharmonic'],
  [/\bphilharmonie\b/g, 'philharmonic'],
  [/\bphilharmonique\b/g, 'philharmonic'],
  [/\bfilarmonica\b/g, 'philharmonic'],
  [/\bsinfonieorchester\b/g, 'symphony orchestra'],
  [/\bsymphonieorchester\b/g, 'symphony orchestra'],
  [/\bsymphonique\b/g, 'symphony'],
  [/\bsinfonica\b/g, 'symphony'],
  [/\borchestre\b/g, 'orchestra'],
  [/\borchester\b/g, 'orchestra'],
  [/\borquesta\b/g, 'orchestra'],
  [/\borchestra\b/g, 'orchestra'],
  [/\bstaatskapelle\b/g, 'staatskapelle'],
]
const FILLER = new Set(['the', 'of', 'de', 'des', 'du', 'la', 'le', 'des', 'and', 'et', 'und', 'orchestra', 'symphony', 'philharmonic', 'national', 'radio', 'chamber'])

export function orchestraTokens(name: string): string[] {
  let s = fold(name)
  for (const [re, to] of ORCHESTRA_WORDS) s = s.replace(re, to)
  const all = s.split(' ').filter(Boolean)
  const distinctive = all.filter((t) => !FILLER.has(t))
  // "London Symphony Orchestra" → [london]; "Cleveland Orchestra" → [cleveland];
  // "Orchestre de Paris" → [paris]. If nothing distinctive is left, use all.
  return distinctive.length ? distinctive : all
}

function credited(artists: { name: string }[]): string {
  let s = ` ${artists.map((a) => fold(a.name)).join(' | ')} `
  for (const [re, to] of ORCHESTRA_WORDS) s = s.replace(re, to)
  return s
}

const tokens = (s: string) => s.split(' ').filter(Boolean)

/** How much of the work's identifying title appears in a track (or album) name, 0..1. */
export function workOverlap(workTitle: string, trackName: string): number {
  const want = tokens(workTitleKey(workTitle))
  if (want.length === 0) return 0
  const have = new Set(tokens(workTitleKey(trackName)).concat(tokens(fold(trackName))))
  return want.filter((t) => have.has(t)).length / want.length
}

function personCredited(name: string, credits: string): boolean {
  const last = surname(name)
  return last.length > 1 && new RegExp(`\\b${last}\\b`).test(credits)
}

function orchestraCredited(name: string, credits: string): boolean {
  const toks = orchestraTokens(name)
  return toks.length > 0 && toks.every((t) => new RegExp(`\\b${t}\\b`).test(credits))
}

export interface MatchResult {
  level: MatchLevel
  work: number
  composer: boolean
  missing: string[]
}

export function matchTrack(track: SpotifyTrackLike, p: ProposedRecording): MatchResult {
  const credits = credited(track.artists)
  // Classical tracks often carry the work in the album name and only the
  // movement in the track name ("I. Allegro con brio"); take the better of the two.
  const work = Math.max(workOverlap(p.work, track.name), track.album ? workOverlap(p.work, track.album.name) * 0.95 : 0)
  const composer = personCredited(p.composer, credits)
  const missing: string[] = []
  if (p.conductor && !personCredited(p.conductor, credits)) missing.push(p.conductor)
  if (p.orchestra && !orchestraCredited(p.orchestra, credits)) missing.push(p.orchestra)
  if (p.ensemble && !orchestraCredited(p.ensemble, credits)) missing.push(p.ensemble)
  for (const s of p.soloists) if (!personCredited(s.name, credits)) missing.push(s.name)

  const lead = p.conductor ?? p.soloists[0]?.name ?? p.ensemble ?? p.orchestra
  const leadOk = lead ? !missing.includes(lead) : false

  let level: MatchLevel = 'none'
  if (work >= 0.99 && missing.length === 0) level = 'strong'
  else if (work >= 0.75 && composer && leadOk) level = 'probable'
  return { level, work, composer, missing }
}

const RANK: Record<MatchLevel, number> = { none: 0, probable: 1, strong: 2 }

/** The best candidate, or null when none is good enough to link. */
export function bestTrack(candidates: SpotifyTrackLike[], p: ProposedRecording): { track: SpotifyTrackLike; result: MatchResult } | null {
  let best: { track: SpotifyTrackLike; result: MatchResult } | null = null
  for (const track of candidates) {
    const result = matchTrack(track, p)
    if (result.level === 'none') continue
    if (!best || RANK[result.level] > RANK[best.result.level] || (result.level === best.result.level && result.work > best.result.work)) {
      best = { track, result }
    }
  }
  return best
}

/**
 * Of an album's tracks, the ones that make up the work: the run of
 * consecutive tracks around the matched one that carry the work's title.
 * Falls back to the matched track alone.
 */
export function workTracks(albumTracks: SpotifyTrackLike[], matched: SpotifyTrackLike, workTitle: string): SpotifyTrackLike[] {
  const ordered = [...albumTracks].sort((a, b) => (a.disc_number ?? 1) - (b.disc_number ?? 1) || (a.track_number ?? 0) - (b.track_number ?? 0))
  const at = ordered.findIndex((t) => t.id === matched.id)
  if (at < 0) return [matched]
  const fits = (t: SpotifyTrackLike) => workOverlap(workTitle, t.name) >= 0.99
  if (!fits(ordered[at])) return [matched]
  let start = at
  let end = at
  while (start > 0 && fits(ordered[start - 1])) start--
  while (end < ordered.length - 1 && fits(ordered[end + 1])) end++
  return ordered.slice(start, end + 1)
}

/** Search queries, most specific first. Spotify's search caps a page at ten results. */
export function searchQueries(p: ProposedRecording): string[] {
  const work = workTitleKey(p.work).split(' ').slice(0, 6).join(' ')
  const composer = surname(p.composer)
  const lead = p.conductor ? surname(p.conductor) : p.soloists[0] ? surname(p.soloists[0].name) : ''
  const band = p.orchestra ?? p.ensemble
  const bandWords = band ? orchestraTokens(band).slice(0, 2).join(' ') : ''
  const qs = [
    [composer, work, lead].filter(Boolean).join(' '),
    [work, lead, bandWords].filter(Boolean).join(' '),
    [composer, work, bandWords].filter(Boolean).join(' '),
  ]
  return [...new Set(qs.filter((q) => q.trim().length > 0))]
}
