import type { Album, ListeningEvent, ProposedRecording, Recording } from '../domain/types'
import { newId } from '../domain/identity'
import type { Repo } from '../store/repo'
import { MATCHER_VERSION, bestTrack, isCredited, movementTitle, searchQueries, workOverlap, workTracks, type SpotifyTrackLike } from './match'
import type { RecentPlay, SpotifyAlbum, SpotifyClient } from './client'

/**
 * The factual layer: look for the curator's proposed recording on Spotify and
 * record what Spotify itself says about it. Only what Spotify returns is stored
 * as metadata (album name, release date, ℗ line, credited artists, the tracks);
 * the curator's proposal stays in the programme snapshot, untouched.
 *
 * Three outcomes, and only one of them is a fact the app acts on:
 *   verified    — a strong match, or a near one the listener confirmed. Linked,
 *                 played, put in playlists, counted when Spotify sees it played.
 *   unconfirmed — a near miss (the conductor is right, an orchestra or soloist
 *                 isn't credited). Shown with what differs; nothing else uses it
 *                 until the listener says "yes, this is it" or "not this one".
 *   not-found   — the UI offers a search, never a different interpretation.
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

/** Is this recording the curator's, as far as Spotify and the listener can tell? Only these are linked, played or counted. */
export function isConfirmed(r: Recording | undefined): r is Recording & { spotify: NonNullable<Recording['spotify']> } {
  return Boolean(r && r.verification === 'verified' && r.spotify)
}

/**
 * Should the matcher look (again)? Never looked; or decided by an older,
 * weaker matcher — unless the listener settled it themselves.
 */
export function needsLook(r: Recording | undefined): boolean {
  if (!r) return false
  if (r.verification === 'unchecked') return true
  if (r.spotify?.confirmedByListener) return false
  return (r.checkedWith ?? 1) < MATCHER_VERSION
}

/**
 * Listening Spotify reported against a match that has just been withdrawn was
 * never about this recording; it goes with the match. What the listener marked
 * by hand stays.
 */
async function forgetSpotifyListening(repo: Repo, recordingId: string): Promise<void> {
  const stale = (await repo.events.all()).filter((e) => e.recordingId === recordingId && e.source === 'spotify-recent')
  for (const e of stale) await repo.events.delete(e.id)
}

export async function verifyRecording(repo: Repo, spotify: SpotifyClient, recordingId: string, proposed: ProposedRecording, now = new Date().toISOString()): Promise<VerifyOutcome> {
  const recording = await repo.recordings.require(recordingId)
  if (!needsLook(recording)) return { recording, album: recording.albumId ? await repo.albums.get(recording.albumId) : undefined }

  const rejected = new Set(recording.rejectedAlbumIds ?? [])
  let found: { track: SpotifyTrackLike; level: 'strong' | 'probable' } | null = null
  for (const q of searchQueries(proposed)) {
    const candidates = (await spotify.searchTracks(q)).filter((t) => !t.album || !rejected.has(t.album.id))
    const best = bestTrack(candidates, proposed)
    if (best && (!found || (best.result.level === 'strong' && found.level !== 'strong'))) found = { track: best.track, level: best.result.level as 'strong' | 'probable' }
    if (found?.level === 'strong') break
  }

  const { spotify: before, albumId: _albumId, ...bare } = recording
  if (!found || !found.track.album) {
    if (before) await forgetSpotifyListening(repo, recordingId)
    const updated: Recording = { ...bare, verification: 'not-found', checkedAt: now, checkedWith: MATCHER_VERSION }
    await repo.recordings.put(updated)
    return { recording: updated }
  }

  const albumId = found.track.album.id
  const [album, tracks] = await Promise.all([spotify.album(albumId), spotify.albumTracks(albumId)])
  const work = workTracks(tracks, found.track, proposed.work)
  const credited = [...new Set(work.flatMap((t) => t.artists.map((a) => a.name)))]
  const image = [...(album.images ?? [])].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url
  const trackIds = work.map((t) => t.id)
  const sameAsBefore = before?.albumId === albumId && before.trackIds.join() === trackIds.join() && recording.verification === 'verified' && found.level === 'strong'
  if (before && !sameAsBefore) await forgetSpotifyListening(repo, recordingId)

  const updated: Recording = {
    ...bare,
    verification: found.level === 'strong' ? 'verified' : 'unconfirmed',
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
      trackIds,
      trackUris: work.map((t) => t.uri),
      trackNames: work.map((t) => movementTitle(t.name)),
      confidence: found.level,
      matchedAt: now,
      durationMs: work.reduce((n, t) => n + (t.duration_ms ?? 0), 0) || undefined,
    },
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

/** The listener says a near match IS the curator's recording. */
export async function confirmMatch(repo: Repo, recordingId: string, now = new Date().toISOString()): Promise<Recording> {
  const r = await repo.recordings.require(recordingId)
  if (r.verification !== 'unconfirmed' || !r.spotify) return r
  const updated: Recording = { ...r, verification: 'verified', spotify: { ...r.spotify, confirmedByListener: now } }
  await repo.recordings.put(updated)
  return updated
}

/**
 * The listener says a match is NOT the curator's recording. That album is
 * never offered for it again, and Spotify is asked once more — another album
 * may be the right one; if none is, it is not found, and a stand-in follows.
 */
export async function rejectMatch(repo: Repo, spotify: SpotifyClient | null, recordingId: string, proposed: ProposedRecording, now = new Date().toISOString()): Promise<Recording> {
  const r = await repo.recordings.require(recordingId)
  const { spotify: before, albumId, ...bare } = r
  if (before) await forgetSpotifyListening(repo, recordingId)
  const rejectedAlbumIds = [...new Set([...(r.rejectedAlbumIds ?? []), ...(albumId ? [albumId] : [])])]
  const reset: Recording = { ...bare, rejectedAlbumIds, verification: 'unchecked' }
  await repo.recordings.put(reset)
  if (!spotify?.connected) return reset
  return (await verifyRecording(repo, spotify, recordingId, proposed, now)).recording
}

/** One recording of a work that Spotify actually has, for the curator to choose from. */
export interface SpotifyCandidate {
  album: string
  /** For a link to the album; left out of what the curator is sent. */
  albumId?: string
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
      if (artists.length) byAlbum.set(t.album.id, { album: t.album.name, albumId: t.album.id, year: t.album.release_date?.slice(0, 4), artists })
    }
    if (byAlbum.size >= max) break
  }
  return [...byAlbum.values()].slice(0, max)
}

/**
 * Turn Spotify's recently-played history into listening events for confirmed
 * recordings. What Spotify actually tells us is thin: the last fifty tracks,
 * each with the time it was played, and a track only appears once it has
 * played for about thirty seconds — never how much of it was heard. So:
 *
 * - plays of one recording's tracks less than three hours apart are one
 *   session;
 * - a session that reached most (≥ 60%) of a multi-movement work's tracks is
 *   `heard`; less is `partial` (shown as "Started");
 * - a single-track work can never be told apart from thirty seconds of it, so
 *   Spotify only ever marks it `partial` — "heard" is the listener's word;
 * - each session is recorded once: a later poll that sees the same session
 *   (even with its first plays scrolled out of the fifty) only upgrades a
 *   partial to heard, never adds a second hearing.
 */
const SESSION_GAP = 3 * 3600_000

export function playsToEvents(plays: RecentPlay[], recordings: Recording[], known: ListeningEvent[], now: string): ListeningEvent[] {
  const byTrack = new Map<string, Recording>()
  for (const r of recordings) if (isConfirmed(r)) for (const t of r.spotify.trackIds) byTrack.set(t, r)

  // Group plays per recording into sessions: plays of its tracks within three hours of each other.
  const sessions = new Map<string, { recording: Recording; tracks: Set<string>; last: string; first: string }[]>()
  for (const play of [...plays].sort((a, b) => a.played_at.localeCompare(b.played_at))) {
    const r = byTrack.get(play.track.id)
    if (!r) continue
    const list = sessions.get(r.id) ?? []
    const cur = list[list.length - 1]
    if (cur && Date.parse(play.played_at) - Date.parse(cur.last) < SESSION_GAP) {
      cur.tracks.add(play.track.id)
      cur.last = play.played_at
    } else {
      list.push({ recording: r, tracks: new Set([play.track.id]), first: play.played_at, last: play.played_at })
    }
    sessions.set(r.id, list)
  }

  const recorded = known.filter((e) => e.source === 'spotify-recent' && e.playedAt)
  const out: ListeningEvent[] = []
  for (const list of sessions.values()) {
    for (const s of list) {
      const total = s.recording.spotify?.trackIds.length ?? 1
      const heard = total > 1 && s.tracks.size / total >= 0.6
      // The same session, already recorded? Overlapping, or within a session gap of it.
      const same = recorded.filter((e) => e.recordingId === s.recording.id
        && Date.parse(s.first) - Date.parse(e.playedUntil ?? e.playedAt!) < SESSION_GAP
        && Date.parse(e.playedAt!) - Date.parse(s.last) < SESSION_GAP)
      if (same.some((e) => e.kind === 'heard') || (same.length && !heard)) continue
      const anchor = same[0]
      out.push({
        id: newId('ev'),
        at: now,
        kind: heard ? 'heard' : 'partial',
        recordingId: s.recording.id,
        workId: s.recording.workId,
        source: 'spotify-recent',
        tracksPlayed: s.tracks.size,
        tracksTotal: total,
        // An upgrade keeps the session's original start, so it stays one session.
        playedAt: anchor?.playedAt && anchor.playedAt < s.first ? anchor.playedAt : s.first,
        playedUntil: s.last,
      })
    }
  }
  return out
}

let inFlight: Promise<number> | null = null

/** Fetch recent plays and store any new listening they show. Returns how many events were added. One at a time. */
export function syncRecentPlays(repo: Repo, spotify: SpotifyClient, now = new Date().toISOString()): Promise<number> {
  if (!spotify.connected) return Promise.resolve(0)
  inFlight ??= (async () => {
    try {
      const plays = await spotify.recentlyPlayed()
      const fresh = playsToEvents(plays, await repo.recordings.all(), await repo.events.all(), now)
      if (fresh.length) await repo.events.putMany(fresh)
      return fresh.length
    } finally {
      inFlight = null
    }
  })()
  return inFlight
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

export interface PlaylistMark {
  id: string
  url: string
  tracks: number
  /** Exactly what was written, so the app can tell when the playlist has fallen behind. Absent on marks saved before this was kept. */
  uris?: string[]
}

/** Every confirmed recording's tracks, in programme order (comparison perspectives after the items). */
async function playlistUris(repo: Repo, programmeId: string): Promise<{ title: string; dek: string; uris: string[] }> {
  const p = await repo.programmes.require(programmeId)
  const items = p.sections.flatMap((s) => s.items)
  // The programme's own pairs, plus any stand-in for a recording Spotify lacks.
  const standIns = (await repo.comparisons.many(items.map((i) => `cmp:${programmeId}:${i.id}`))).filter((c) => c.standIn)
  const comparisons = [...(await repo.comparisons.many(p.comparisonIds)), ...standIns]
  const ids = [...new Set([
    ...items.map((i) => i.recordingId),
    ...comparisons.flatMap((c) => c.perspectives.map((x) => x.recordingId)),
  ])]
  const byId = new Map((await repo.recordings.many(ids)).map((r) => [r.id, r]))
  // Only recordings Spotify confirmed — a near miss waiting for the listener stays out.
  const uris = ids.flatMap((id) => { const r = byId.get(id); return isConfirmed(r) ? r.spotify.trackUris : [] })
  return { title: p.title, dek: p.dek, uris }
}

/**
 * The week's programme as a private Spotify playlist: exactly the tracks that
 * were matched. Saving again replaces the tracks in the same playlist.
 */
export async function saveProgrammePlaylist(repo: Repo, spotify: SpotifyClient, programmeId: string, weekLabel: string): Promise<PlaylistMark> {
  const { title, dek, uris } = await playlistUris(repo, programmeId)
  if (uris.length === 0) throw new Error('None of this week’s recordings are confirmed on Spotify yet.')
  const mark = await repo.marks.get(`playlist:${programmeId}`)
  const prior = mark?.value as PlaylistMark | undefined
  const saved = await spotify.writePlaylist(`The Long Listen — ${title}`, `${weekLabel}. ${dek}`, uris, prior?.id)
  const value: PlaylistMark = { ...saved, tracks: uris.length, uris }
  await repo.marks.put({ id: `playlist:${programmeId}`, at: new Date().toISOString(), value })
  return value
}

/**
 * Once a playlist has been saved, it follows the programme on its own: when a
 * recording is confirmed later, swapped ("Not this recording?") or given a
 * stand-in, the playlist is rewritten to match. Does nothing when it already
 * matches, when there's no playlist yet, or when nothing is confirmed.
 * Returns whether it wrote.
 */
export async function keepPlaylistCurrent(repo: Repo, spotify: SpotifyClient, programmeId: string, weekLabel: string): Promise<boolean> {
  const mark = (await repo.marks.get(`playlist:${programmeId}`))?.value as PlaylistMark | undefined
  if (!mark) return false
  const { uris } = await playlistUris(repo, programmeId)
  if (uris.length === 0) return false
  if (mark.uris && mark.uris.length === uris.length && mark.uris.every((u, i) => u === uris[i])) return false
  await saveProgrammePlaylist(repo, spotify, programmeId, weekLabel)
  return true
}

/** Recordings being looked up right now, page-wide, so two callers never check the same one twice. */
const looking = new Set<string>()

/**
 * Confirm every recording a programme needs on Spotify — three at a time, not
 * one after another, so a new week's programme fills in quickly. Started as
 * soon as a direction is chosen, and again whenever the programme is opened;
 * a recording already confirmed or being looked up is left alone. Stops at the
 * first sign-in or rate-limit problem: what's left waits for the next open.
 */
export async function verifyProgramme(
  repo: Repo, spotify: SpotifyClient, programmeId: string, onEach?: () => void, concurrency = 3,
): Promise<number> {
  if (!spotify.connected) return 0
  const p = await repo.programmes.require(programmeId)
  const items = p.sections.flatMap((s) => s.items)
  const comparisons = await repo.comparisons.many([...p.comparisonIds, ...items.map((i) => `cmp:${programmeId}:${i.id}`)])
  const wanted = [
    ...items.map((i) => ({ rid: i.recordingId, proposed: i.proposed })),
    ...comparisons.flatMap((c) => c.perspectives.map((x) => ({ rid: x.recordingId, proposed: x.proposed }))),
  ]
  const byId = new Map((await repo.recordings.many(wanted.map((w) => w.rid))).map((r) => [r.id, r]))
  const queue = wanted.filter(({ rid }, i) => wanted.findIndex((w) => w.rid === rid) === i && needsLook(byId.get(rid)) && !looking.has(rid))
  let done = 0
  let failed = false
  const worker = async () => {
    for (let job = queue.shift(); job && !failed; job = queue.shift()) {
      looking.add(job.rid)
      try {
        await verifyRecording(repo, spotify, job.rid, job.proposed)
        done++
        onEach?.()
      } catch {
        failed = true // signed out, offline or throttled: the buttons stay, nothing is lost
      } finally {
        looking.delete(job.rid)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker))
  return done
}
