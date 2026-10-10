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
 *   strong   — the composer is named, the work title matches, and every named
 *              performer is credited. Accepted as the recording.
 *   probable — composer named, work mostly matches, the conductor (or first
 *              soloist) is credited but someone else isn't. Might be the same
 *              recording credited differently, might be another one by the
 *              same conductor; only the listener can say, so it is held as
 *              `unconfirmed` and never linked, played or counted until they do.
 *   none     — anything less, or a track that contradicts the proposal (another
 *              catalogue number, a release older than the recording). The UI
 *              says "not found on Spotify" rather than link a different
 *              interpretation.
 */
export interface SpotifyTrackLike {
  id: string
  name: string
  uri: string
  artists: { name: string; id?: string }[]
  album?: { id: string; name: string; release_date?: string }
  track_number?: number
  disc_number?: number
  duration_ms?: number
  /** The id that was asked for, when Spotify relinked the track for the listener's market. */
  linked_from?: { id?: string }
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

/**
 * Bumped whenever matching gets better, so recordings an older matcher
 * decided about are looked at once more.
 *   2 — bracketed version notes no longer count as title words
 *   3 — the composer must be named; a contradicting catalogue number or a
 *       release older than the recording rules a track out; a near miss is
 *       held for the listener to confirm instead of being linked. Matches an
 *       older matcher accepted are re-checked (it once passed Beethoven's 7th
 *       for Sibelius's, same conductor, same orchestra).
 *   4 — "violoncello" is "cello" in a title, so "Concerto for Violoncello"
 *       is found for a cello concerto.
 *   5 — a movement number after the colon no longer passes for the work's
 *       number ("Symphony No. 2: 4. Urlicht" is not the fourth); another
 *       work's opus on a coupling album no longer rules a track out; "BWV1048"
 *       and "KV 550" read as "BWV 1048" and "K. 550"; a track naming the
 *       proposal's catalogue number is the work despite a nickname; albums
 *       past their 200th track are read to the end.
 */
export const MATCHER_VERSION = 5

/**
 * The curator often adds a version note in brackets — "(original piano
 * version)", "[orch. Ravel]" — that Spotify's track names never carry. They
 * describe the recording, not the work's title, so matching ignores them.
 * (`workTitleKey` drops them too now; this stays for the catalogue spelling, which runs first.)
 */
function matchTitle(title: string): string {
  return title.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
}

// One instrument, several spellings: "Concerto for Violoncello" is a cello concerto.
const SAME_WORD: [RegExp, string][] = [
  [/\bviolon(?:cello|celle|cel)\b/g, 'cello'],
  [/\bvioloncelo\b/g, 'cello'],
]
const sameWords = (s: string) => SAME_WORD.reduce((acc, [re, to]) => acc.replace(re, to), s)

/**
 * Spotify spells catalogue numbers several ways — "BWV1048" for "BWV 1048",
 * "KV 550" for "K. 550" — and each spelling folds to different words, so the
 * same number would count as missing from the title. One spelling for both
 * sides before the words are compared.
 */
function catalogueSpelling(title: string): string {
  return title
    .replace(/\b(bwv|kv|k|hob|rv|wwv|op|d|l)\.?(?=\d)/gi, '$1 ')
    .replace(/\bkv\b/gi, 'K')
}

/**
 * The part of a track name that names the work. "Symphony No. 2 in C Minor:
 * 4. Urlicht" is the second symphony's fourth movement, and the "4" must not
 * pass for "Symphony No. 4" — so a movement after the last colon is left out.
 * Only a numbered movement: in "Bach: Brandenburg Concerto No. 3" or
 * "Pictures at an Exhibition: Promenade I" what follows the colon is the work,
 * or part of its name, and stays.
 */
export function workPart(trackName: string): string {
  const at = trackName.lastIndexOf(':')
  if (at < 0) return trackName
  return movementNumber(trackName.slice(at + 1)) === undefined ? trackName : trackName.slice(0, at)
}

/** How much of the work's identifying title appears in a track (or album) name, 0..1. */
export function workOverlap(workTitle: string, trackName: string): number {
  const want = tokens(sameWords(workTitleKey(catalogueSpelling(matchTitle(workTitle)))))
  if (want.length === 0) return 0
  const name = catalogueSpelling(workPart(trackName))
  const have = new Set(tokens(sameWords(workTitleKey(name))).concat(tokens(sameWords(fold(name)))))
  return want.filter((t) => have.has(t)).length / want.length
}

/** Is this person credited among these artists (by surname)? */
export function isCredited(name: string, artists: { name: string }[]): boolean {
  return personCredited(name, credited(artists))
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

// Catalogue schemes common in track titles: "Op. 92", "BWV 1048", "K. 550", "D. 944", "L. 109", "Hob. I:104".
const CATALOGUE = /\b(op|opus|bwv|k|kv|d|l|hob|s|rv|wwv)\.?\s*([ivx]+:)?\s*(\d+)/gi

/** Catalogue numbers named in a text, as "op 92", "bwv 1048" … */
function catalogueNumbers(text: string): Set<string> {
  const out = new Set<string>()
  for (const m of text.matchAll(CATALOGUE)) {
    const scheme = m[1].toLowerCase().replace(/^opus$/, 'op').replace(/^kv$/, 'k')
    out.add(`${scheme} ${(m[2] ?? '').toLowerCase()}${Number(m[3])}`)
  }
  return out
}

/**
 * Does the track name the proposal's own catalogue number? "Concerto for
 * Violin, Cello and Orchestra in A minor, Op. 102" shares one word with
 * "Double Concerto", and is the same work: the number says so.
 */
export function catalogueAgrees(p: ProposedRecording, trackText: string): boolean {
  const want = catalogueNumbers(`${p.catalogue ?? ''} ${p.work}`)
  if (!want.size) return false
  for (const h of catalogueNumbers(trackText)) if (want.has(h)) return true
  return false
}

const schemeOf = (n: string) => n.split(' ')[0]

/**
 * Does the track name a catalogue number of the same scheme as the proposal's,
 * but a different one?
 *
 * The album is a weaker witness than the track. A coupling is billed with
 * both works' numbers — "Symphony No. 5, Op. 67 & Symphony No. 7, Op. 92" —
 * so another opus on the album says nothing against this track. It is only
 * heard for a scheme the track's own name doesn't use (a track named "I. Poco
 * sostenuto" leaves the album to say which work it is), and only when none of
 * the album's numbers of that scheme is the proposal's.
 */
export function catalogueContradicts(p: ProposedRecording, trackText: string, albumText = ''): boolean {
  const want = catalogueNumbers(`${p.catalogue ?? ''} ${p.work}`)
  if (!want.size) return false
  const wanted = (scheme: string) => [...want].filter((w) => schemeOf(w) === scheme)
  const have = catalogueNumbers(trackText)
  for (const h of have) {
    const same = wanted(schemeOf(h))
    if (same.length && !same.includes(h)) return true
  }
  const named = new Set([...have].map(schemeOf))
  const onAlbum = [...catalogueNumbers(albumText)].filter((h) => !named.has(schemeOf(h)))
  for (const scheme of new Set(onAlbum.map(schemeOf))) {
    const same = wanted(scheme)
    if (same.length && !onAlbum.some((h) => schemeOf(h) === scheme && same.includes(h))) return true
  }
  return false
}

/** The numbers after "No." in a title: "String Quartet No. 7, Op. 59 No. 1" → 7, 1. */
function numberedAs(text: string): Set<number> {
  return new Set([...text.matchAll(/\b(?:no|nr|nos)\.?\s*(\d+)/gi)].map((m) => Number(m[1])))
}

/**
 * Does the track's own name identify the proposal's work by its catalogue
 * number? Then a title spelt differently — a nickname the curator added
 * ("Eroica"), a key left out — doesn't make it a lesser match. Guarded twice:
 * nothing may contradict it, and a numbered work must not be another of the
 * same opus (Op. 59 No. 1 and No. 2 are two quartets under one number).
 */
function catalogueIdentifies(p: ProposedRecording, trackName: string, albumName = ''): boolean {
  const name = workPart(trackName)
  if (!catalogueAgrees(p, name) || catalogueContradicts(p, trackName, albumName)) return false
  const want = numberedAs(`${p.work} ${p.catalogue ?? ''}`)
  const have = numberedAs(name)
  return !want.size || !have.size || [...want].every((n) => have.has(n))
}

/** A release can't come before the recording on it: a proposed 1987 recording isn't on a 1964 album. */
function releasedTooEarly(p: ProposedRecording, track: SpotifyTrackLike): boolean {
  const recorded = Number(/\b(1[89]\d\d|20\d\d)\b/.exec(p.year ?? '')?.[1])
  const released = Number(track.album?.release_date?.slice(0, 4))
  return Boolean(recorded && released && released < recorded - 1)
}

export function matchTrack(track: SpotifyTrackLike, p: ProposedRecording): MatchResult {
  const credits = credited(track.artists)
  // Classical tracks often carry the work in the album name and only the
  // movement in the track name ("I. Allegro con brio"); take the better of the two.
  // A track whose own name carries the proposal's catalogue number is the work,
  // however else its title is spelt.
  const work = catalogueIdentifies(p, track.name, track.album?.name)
    ? 1
    : Math.max(workOverlap(p.work, track.name), track.album ? workOverlap(p.work, track.album.name) * 0.95 : 0)
  // The composer is credited as an artist on nearly every classical track; a
  // few older uploads only name them in the title. Either will do — but one of
  // them must, or "Symphony No. 7" by the right conductor could be anyone's.
  const titles = `${track.name} ${track.album?.name ?? ''}`
  const composer = personCredited(p.composer, credits) || personCredited(p.composer, ` ${fold(titles)} `)
  const missing: string[] = []
  if (p.conductor && !personCredited(p.conductor, credits)) missing.push(p.conductor)
  if (p.orchestra && !orchestraCredited(p.orchestra, credits)) missing.push(p.orchestra)
  if (p.ensemble && !orchestraCredited(p.ensemble, credits)) missing.push(p.ensemble)
  for (const s of p.soloists) if (!personCredited(s.name, credits)) missing.push(s.name)

  const lead = p.conductor ?? p.soloists[0]?.name ?? p.ensemble ?? p.orchestra
  const leadOk = lead ? !missing.includes(lead) : false

  let level: MatchLevel = 'none'
  if (!composer || catalogueContradicts(p, track.name, track.album?.name) || releasedTooEarly(p, track)) level = 'none'
  else if (work >= 0.99 && missing.length === 0) level = 'strong'
  else if (work >= 0.75 && leadOk) level = 'probable'
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
 * Falls back to the matched track alone. Given the proposal, a track naming
 * its catalogue number carries the work too, as it does for `matchTrack` —
 * otherwise a work matched that way would shrink to the one movement found.
 */
export function workTracks(albumTracks: SpotifyTrackLike[], matched: SpotifyTrackLike, workTitle: string, p?: ProposedRecording): SpotifyTrackLike[] {
  const ordered = [...albumTracks].sort((a, b) => (a.disc_number ?? 1) - (b.disc_number ?? 1) || (a.track_number ?? 0) - (b.track_number ?? 0))
  const at = ordered.findIndex((t) => t.id === matched.id)
  if (at < 0) return [matched]
  const fits = (t: SpotifyTrackLike) => workOverlap(workTitle, t.name) >= 0.99 || Boolean(p && catalogueIdentifies(p, t.name))
  if (!fits(ordered[at])) return movementRun(ordered, at) ?? [matched]
  let start = at
  let end = at
  while (start > 0 && fits(ordered[start - 1])) start--
  while (end < ordered.length - 1 && fits(ordered[end + 1])) end++
  return ordered.slice(start, end + 1)
}

const ROMAN: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12 }

/** "III. Allegro" → 3, "2. Andante" → 2; anything else, undefined. */
function movementNumber(name: string): number | undefined {
  const m = /^\s*([ivx]+|\d{1,2})[.:)]\s/i.exec(name)
  if (!m) return undefined
  return /\d/.test(m[1]) ? Number(m[1]) : ROMAN[m[1].toLowerCase()]
}

/**
 * Tracks named only by their movement ("I. Allegro", "II. Andante"), as some
 * albums name them — the work's title is on the album, not the track. The run
 * is the matched track and its neighbours numbered one up and one down, so it
 * stops where the next work's "I." begins.
 */
function movementRun(ordered: SpotifyTrackLike[], at: number): SpotifyTrackLike[] | undefined {
  const n = movementNumber(ordered[at].name)
  if (n === undefined) return undefined
  let start = at
  let end = at
  while (start > 0 && movementNumber(ordered[start - 1].name) === (movementNumber(ordered[start].name) ?? 0) - 1) start--
  while (end < ordered.length - 1 && movementNumber(ordered[end + 1].name) === (movementNumber(ordered[end].name) ?? 0) + 1) end++
  return end > start ? ordered.slice(start, end + 1) : undefined
}

/** Search queries, most specific first. Spotify's search caps a page at ten results. */
export function searchQueries(p: ProposedRecording): string[] {
  const work = workTitleKey(matchTitle(p.work)).split(' ').slice(0, 6).join(' ')
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

/** "La mer, L. 109: II. Jeux de vagues" → "II. Jeux de vagues". A single-track work keeps its name. */
export function movementTitle(trackName: string): string {
  const at = trackName.lastIndexOf(':')
  return at >= 0 && at < trackName.length - 1 ? trackName.slice(at + 1).trim() : trackName.trim()
}
