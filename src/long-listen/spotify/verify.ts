import type { Album, ListeningEvent, ProposedRecording, Recording } from '../domain/types'
import { newId } from '../domain/identity'
import type { Repo } from '../store/repo'
import { MATCHER_VERSION, bestTrack, isCredited, movementTitle, searchQueries, workOverlap, workTracks, type SpotifyTrackLike } from './match'
import type { RecentPlay, SpotifyAlbum, SpotifyClient } from './client'

/**
 * The factual layer: look for the curator's proposed recording on Spotify and
 * record what Spotify itself says about it. Only what Spotify returns is stored
 * as metadata (album name, release date, ℗ line, credited artists, the tracks);
 * the curator's proposal stays in the programme snapshot, untouched. A recording
 * that can't be found is marked `not-found` — the UI then offers a Spotify
 * search, and never a link to a different interpretation.
 */
export interface VerifyOutcome {
  recording: Recording
  album?: Album
}

/** ℗ 1975 Deutsche Grammophon GmbH, Berlin → "1975 Deutsche Grammophon GmbH, Berlin" */
function phonographic(a: SpotifyAlbum): string | undefined {
  const p = a.copyrights?.find((c) => c.type === 'P') ?? a.copyrights?.[0]
  return p?.text.replace(/^\s*(?:℗|\(P\)|©|\(C\))\s*/i, '').trim() || undefined
}

/** Has this recording never been looked for, or only by an older, weaker matcher? */
export function needsLook(r: Recording | undefined): boolean {
  if (!r) return false
  return r.verification === 'unchecked' || (r.verification === 'not-found' && (r.checkedWith ?? 1) < MATCHER_VERSION)
}

export async function verifyRecording(repo: Repo, spotify: SpotifyClient, recordingId: string, proposed: ProposedRecording, now = new Date().toISOString()): Promise<VerifyOutcome> {
  const recording = await repo.recordings.require(recordingId)
  if (recording.verification === 'verified') return { recording, album: recording.albumId ? await repo.albums.get(recording.albumId) : undefined }

  let found: { track: SpotifyTrackLike; level: 'strong' | 'probable' } | null = null
  for (const q of searchQueries(proposed)) {
    const best = bestTrack(await spotify.searchTracks(q), proposed)
    if (best && (!found || (best.result.level === 'strong' && found.level !== 'strong'))) found = { track: best.track, level: best.result.level as 'strong' | 'probable' }
    if (found?.level === 'strong') break
  }

  if (!found || !found.track.album) {
    const updated: Recording = { ...recording, verification: 'not-found', checkedAt: now, checkedWith: MATCHER_VERSION }
    await repo.recordings.put(updated)
    return { recording: updated }
  }

  const albumId = found.track.album.id
  const [album, tracks] = await Promise.all([spotify.album(albumId), spotify.albumTracks(albumId)])
  const work = workTracks(tracks, found.track, proposed.work)
  const credited = [...new Set(work.flatMap((t) => t.artists.map((a) => a.name)))]
  const image = [...(album.images ?? [])].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url

  const updated: Recording = {
    ...recording,
    verification: 'verified',
    checkedAt: now,
    checkedWith: MATCHER_VERSION,
    albumId,
    spotify: {
      albumId,
      albumName: album.name,
      albumUri: album.uri,
      releaseDate: album.release_date,
      phonographic: phonographic(album),
      imageUrl: image,
      artistNames: credited,
      trackIds: work.map((t) => t.id),
      trackUris: work.map((t) => t.uri),
      confidence: found.level,
      matchedAt: now,
      durationMs: work.reduce((n, t) => n + (t.duration_ms ?? 0), 0) || undefined,
    },
  }
  // Movements come from Spotify's own track names, once, if the work has none yet.
  const work0 = await repo.works.get(recording.workId)
  if (work0 && !work0.movements?.length && work.length > 1) {
    await repo.works.put({ ...work0, movements: work.map((t, i) => ({ index: i + 1, title: movementTitle(t.name) })) })
  }
  const existing = await repo.albums.get(albumId)
  const albumRecord: Album = {
    id: albumId,
    name: album.name,
    releaseDate: album.release_date,
    imageUrl: image,
    artistNames: album.artists.map((a) => a.name),
    phonographic: phonographic(album),
    recordingIds: [...new Set([...(existing?.recordingIds ?? []), recordingId])],
  }
  await repo.albums.put(albumRecord)
  await repo.recordings.put(updated)
  return { recording: updated, album: albumRecord }
}

/** One recording of a work that Spotify actually has, for the curator to choose from. */
export interface SpotifyCandidate {
  album: string
  year?: string
  artists: string[]
}

/**
 * Real recordings of this work on Spotify, grouped by album. When the
 * curator's choice isn't there, the replacement is picked from this list,
 * so it is grounded in what exists rather than remembered.
 */
export async function spotifyCandidates(spotify: SpotifyClient, p: ProposedRecording, max = 8): Promise<SpotifyCandidate[]> {
  const composer = p.composer.split(' ').slice(-1)[0]
  const queries = [...new Set([`${composer} ${p.work.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')}`.replace(/\s+/g, ' ').trim(), ...searchQueries(p).slice(0, 1)])]
  const byAlbum = new Map<string, SpotifyCandidate>()
  for (const q of queries) {
    for (const t of await spotify.searchTracks(q)) {
      if (!t.album || byAlbum.has(t.album.id)) continue
      const onWork = Math.max(workOverlap(p.work, t.name), workOverlap(p.work, t.album.name))
      if (onWork < 0.75 || !isCredited(p.composer, t.artists)) continue
      const artists = t.artists.map((a) => a.name).filter((n) => !isCredited(p.composer, [{ name: n }]))
      if (artists.length) byAlbum.set(t.album.id, { album: t.album.name, year: t.album.release_date?.slice(0, 4), artists })
    }
    if (byAlbum.size >= max) break
  }
  return [...byAlbum.values()].slice(0, max)
}

/** Let the listener undo a match they know is wrong; it will be looked for again. */
export async function forgetMatch(repo: Repo, recordingId: string): Promise<void> {
  const r = await repo.recordings.require(recordingId)
  const { spotify: _spotify, albumId: _albumId, ...rest } = r
  await repo.recordings.put({ ...rest, verification: 'unchecked' })
}

/**
 * Turn Spotify's recently-played history into listening events for verified
 * recordings. Hearing most of a work's tracks counts as heard; fewer is a
 * partial listen. Each play is recorded once, however often this runs.
 */
export function playsToEvents(plays: RecentPlay[], recordings: Recording[], known: ListeningEvent[], now: string): ListeningEvent[] {
  // What each session was last recorded as, so a session first seen half-way
  // through and finished later is upgraded to heard, once.
  const seen = new Map<string, ListeningEvent['kind']>()
  for (const e of known) {
    if (e.source !== 'spotify-recent') continue
    const k = `${e.recordingId}@${e.playedAt}`
    if (seen.get(k) !== 'heard') seen.set(k, e.kind)
  }
  const byTrack = new Map<string, Recording>()
  for (const r of recordings) for (const t of r.spotify?.trackIds ?? []) byTrack.set(t, r)

  // Group plays per recording into sessions: plays of its tracks within three hours of each other.
  const sessions = new Map<string, { recording: Recording; tracks: Set<string>; last: string; first: string }[]>()
  for (const play of [...plays].sort((a, b) => a.played_at.localeCompare(b.played_at))) {
    const r = byTrack.get(play.track.id)
    if (!r) continue
    const list = sessions.get(r.id) ?? []
    const cur = list[list.length - 1]
    if (cur && Date.parse(play.played_at) - Date.parse(cur.last) < 3 * 3600_000) {
      cur.tracks.add(play.track.id)
      cur.last = play.played_at
    } else {
      list.push({ recording: r, tracks: new Set([play.track.id]), first: play.played_at, last: play.played_at })
    }
    sessions.set(r.id, list)
  }

  const out: ListeningEvent[] = []
  for (const list of sessions.values()) {
    for (const s of list) {
      const key = `${s.recording.id}@${s.first}`
      const total = s.recording.spotify?.trackIds.length ?? 1
      const heard = s.tracks.size / total >= 0.6
      const before = seen.get(key)
      if (before === 'heard' || (before && !heard)) continue
      out.push({
        id: newId('ev'),
        at: now,
        kind: heard ? 'heard' : 'partial',
        recordingId: s.recording.id,
        workId: s.recording.workId,
        source: 'spotify-recent',
        tracksPlayed: s.tracks.size,
        tracksTotal: total,
        playedAt: s.first,
      })
    }
  }
  return out
}

/** Fetch recent plays and store any new listening they show. Returns how many events were added. */
export async function syncRecentPlays(repo: Repo, spotify: SpotifyClient, now = new Date().toISOString()): Promise<number> {
  if (!spotify.connected) return 0
  const plays = await spotify.recentlyPlayed()
  const fresh = playsToEvents(plays, await repo.recordings.all(), await repo.events.all(), now)
  if (fresh.length) await repo.events.putMany(fresh)
  return fresh.length
}

/** "about 38 minutes", "about 1 hour 10 minutes" — rounded, for planning an evening. */
export function aboutDuration(ms?: number): string | undefined {
  if (!ms) return undefined
  const minutes = Math.max(1, Math.round(ms / 60000))
  if (minutes < 60) return `about ${minutes} minute${minutes === 1 ? '' : 's'}`
  const h = Math.floor(minutes / 60)
  const m = Math.round((minutes % 60) / 5) * 5
  return `about ${h} hour${h === 1 ? '' : 's'}${m ? ` ${m} minutes` : ''}`
}

export interface PlaylistMark { id: string; url: string; tracks: number }

/**
 * The week's programme as a private Spotify playlist: every verified recording
 * in programme order (comparison perspectives after the items), exactly the
 * tracks that were matched. Saving again later replaces the tracks — so once
 * more recordings are verified, the playlist catches up.
 */
export async function saveProgrammePlaylist(repo: Repo, spotify: SpotifyClient, programmeId: string, weekLabel: string): Promise<PlaylistMark> {
  const p = await repo.programmes.require(programmeId)
  const items = p.sections.flatMap((s) => s.items)
  // The programme's own pairs, plus any stand-in for a recording Spotify lacks.
  const standIns = (await repo.comparisons.many(items.map((i) => `cmp:${programmeId}:${i.id}`))).filter((c) => c.standIn)
  const comparisons = [...(await repo.comparisons.many(p.comparisonIds)), ...standIns]
  const ids = [
    ...p.sections.flatMap((s) => s.items).map((i) => i.recordingId),
    ...comparisons.flatMap((c) => c.perspectives.map((x) => x.recordingId)),
  ]
  const recordings = await repo.recordings.many([...new Set(ids)])
  const byId = new Map(recordings.map((r) => [r.id, r]))
  const uris = [...new Set(ids)].flatMap((id) => byId.get(id)?.spotify?.trackUris ?? [])
  if (uris.length === 0) throw new Error('None of this week’s recordings are confirmed on Spotify yet.')
  const mark = await repo.marks.get(`playlist:${programmeId}`)
  const prior = mark?.value as PlaylistMark | undefined
  const saved = await spotify.writePlaylist(`The Long Listen — ${p.title}`, `${weekLabel}. ${p.dek}`, uris, prior?.id)
  const value: PlaylistMark = { ...saved, tracks: uris.length }
  await repo.marks.put({ id: `playlist:${programmeId}`, at: new Date().toISOString(), value })
  return value
}
