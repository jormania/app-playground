import { describe, it, expect, vi } from 'vitest'
import { beginSignIn, completeSignIn, challengeFor, isCallback, SpotifyAuthError } from './auth'
import { verifyRecording, playsToEvents, rejectMatch, confirmMatch, aboutDuration, saveProgrammePlaylist, keepPlaylistCurrent, needsLook, spotifyCandidates, syncRecentPlays } from './verify'
import { SpotifyClient, playbackOf, shortDevice } from './client'
import { Repo, memoryStore } from '../store/repo'
import type { Recording, ProposedRecording, ListeningEvent } from '../domain/types'
import { MATCHER_VERSION, type SpotifyTrackLike } from './match'

function memStorage(): Storage {
  const m = new Map<string, string>()
  return {
    get length() { return m.size },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  }
}

describe('PKCE sign-in', () => {
  it('sends an S256 challenge and the scopes, and remembers the state', async () => {
    const s = memStorage()
    const url = new URL(await beginSignIn('client123', 'https://coneofcold.vercel.app/long-listen-react.html', s))
    expect(url.origin + url.pathname).toBe('https://accounts.spotify.com/authorize')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('scope')).toContain('user-read-recently-played')
    const pending = JSON.parse(s.getItem('long-listen:spotify-pending')!)
    expect(url.searchParams.get('state')).toBe(pending.state)
    expect(url.searchParams.get('code_challenge')).toBe(await challengeFor(pending.verifier))
  })

  it('exchanges the code with the stored verifier when the state matches', async () => {
    const s = memStorage()
    const url = new URL(await beginSignIn('client123', 'https://x/cb', s))
    const { verifier } = JSON.parse(s.getItem('long-listen:spotify-pending')!)
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ access_token: 'AT', refresh_token: 'RT', expires_in: 3600, scope: 'x' })))
    const tokens = await completeSignIn(`?code=abc&state=${url.searchParams.get('state')}`, s, fetchMock as unknown as typeof fetch, 1000)
    expect(tokens).toMatchObject({ accessToken: 'AT', refreshToken: 'RT' })
    const body = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as URLSearchParams
    expect(body.get('code_verifier')).toBe(verifier)
    expect(body.get('redirect_uri')).toBe('https://x/cb')
  })

  it('refuses a forged, replayed, cancelled or stale callback', async () => {
    const s = memStorage()
    await beginSignIn('c', 'https://x/cb', s)
    const fetchMock = vi.fn()
    await expect(completeSignIn('?code=abc&state=forged', s, fetchMock as unknown as typeof fetch)).rejects.toBeInstanceOf(SpotifyAuthError)
    // The pending sign-in was consumed by that attempt: a replay finds nothing.
    await expect(completeSignIn('?code=abc&state=forged', s, fetchMock as unknown as typeof fetch)).rejects.toThrow(/wasn’t started here/)
    await beginSignIn('c', 'https://x/cb', s)
    await expect(completeSignIn('?error=access_denied&state=x', s, fetchMock as unknown as typeof fetch)).rejects.toThrow(/cancelled/)
    const u = new URL(await beginSignIn('c', 'https://x/cb', s))
    await expect(completeSignIn(`?code=a&state=${u.searchParams.get('state')}`, s, fetchMock as unknown as typeof fetch, Date.now() + 20 * 60_000)).rejects.toThrow(/too long/)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(isCallback('?code=a&state=b')).toBe(true)
    expect(isCallback('?view=week')).toBe(false)
  })
})

const proposed: ProposedRecording = { composer: 'Claude Debussy', work: 'La mer', conductor: 'Pierre Boulez', orchestra: 'Cleveland Orchestra', soloists: [] }
const rec: Recording = { id: 'rec1', workId: 'work:claude-debussy:la-mer', soloistIds: [], character: [], verification: 'unchecked' }
const t = (id: string, name: string, n: number, artists = ['Claude Debussy', 'The Cleveland Orchestra', 'Pierre Boulez']): SpotifyTrackLike =>
  ({ id, name, uri: `spotify:track:${id}`, artists: artists.map((a) => ({ name: a })), album: { id: 'alb1', name: 'Debussy: La mer; Nocturnes' }, track_number: n, disc_number: 1, duration_ms: 8 * 60_000 })

function fakeSpotify(search: SpotifyTrackLike[]) {
  return {
    connected: true,
    searchTracks: vi.fn(async () => search),
    album: vi.fn(async () => ({ id: 'alb1', name: 'Debussy: La mer; Nocturnes', uri: 'spotify:album:alb1', release_date: '1995', images: [{ url: 'small', width: 64 }, { url: 'big', width: 640 }], artists: [{ name: 'Pierre Boulez' }], copyrights: [{ type: 'P', text: '℗ 1995 Deutsche Grammophon GmbH, Berlin' }] })),
    albumTracks: vi.fn(async () => [
      t('m1', 'La mer, L. 109: I. De l’aube à midi sur la mer', 1),
      t('m2', 'La mer, L. 109: II. Jeux de vagues', 2),
      t('m3', 'La mer, L. 109: III. Dialogue du vent et de la mer', 3),
      t('n1', 'Nocturnes, L. 91: I. Nuages', 4),
    ]),
  } as unknown as SpotifyClient
}

describe('verifying a recording', () => {
  it('stores what Spotify says — album, ℗ line, credited artists, the work’s tracks', async () => {
    const repo = new Repo(memoryStore())
    await repo.recordings.put(rec)
    const out = await verifyRecording(repo, fakeSpotify([t('m2', 'La mer, L. 109: II. Jeux de vagues', 2)]), 'rec1', proposed, 'now')
    expect(out.recording.verification).toBe('verified')
    expect(out.recording.spotify).toMatchObject({
      albumName: 'Debussy: La mer; Nocturnes', releaseDate: '1995', phonographic: '1995 Deutsche Grammophon GmbH, Berlin',
      imageUrl: 'big', trackIds: ['m1', 'm2', 'm3'], confidence: 'strong',
    })
    expect((await repo.albums.require('alb1')).recordingIds).toEqual(['rec1'])
    expect(out.recording.spotify?.durationMs).toBe(24 * 60_000)
  })

  it('keeps the movements on the recording, as its album divides them — never on the work', async () => {
    const repo = new Repo(memoryStore())
    await repo.recordings.put(rec)
    await repo.works.put({ id: rec.workId, composerId: 'composer:claude-debussy', title: 'La mer' })
    const out = await verifyRecording(repo, fakeSpotify([t('m1', 'La mer, L. 109: I. De l’aube à midi sur la mer', 1)]), 'rec1', proposed, 'now')
    expect(out.recording.spotify?.trackNames).toEqual(['I. De l’aube à midi sur la mer', 'II. Jeux de vagues', 'III. Dialogue du vent et de la mer'])
    // A wrong match once renamed a work's movements for every recording of it.
    expect((await repo.works.require(rec.workId)).movements).toBeUndefined()
  })

  it('says not found rather than link someone else’s La mer', async () => {
    const repo = new Repo(memoryStore())
    await repo.recordings.put(rec)
    const karajan = t('k1', 'La mer, L. 109: I. De l’aube à midi sur la mer', 1, ['Claude Debussy', 'Berliner Philharmoniker', 'Herbert von Karajan'])
    const out = await verifyRecording(repo, fakeSpotify([karajan]), 'rec1', proposed, 'now')
    expect(out.recording.verification).toBe('not-found')
    expect(out.recording.spotify).toBeUndefined()
  })

  it('looks again for a not-found an older matcher gave up on, and not for one this matcher checked', () => {
    expect(needsLook({ ...rec, verification: 'not-found' })).toBe(true)
    expect(needsLook({ ...rec, verification: 'not-found', checkedWith: MATCHER_VERSION })).toBe(false)
    expect(needsLook({ ...rec, verification: 'unchecked' })).toBe(true)
  })

  it('lists the recordings of a work Spotify really has, by album, for a stand-in', async () => {
    const karajan = { ...t('k1', 'La mer, L. 109: I. De l’aube à midi sur la mer', 1, ['Claude Debussy', 'Berliner Philharmoniker', 'Herbert von Karajan']), album: { id: 'alb2', name: 'Debussy: La mer', release_date: '1964-01-01' } }
    const other = { ...t('x1', 'Nocturnes, L. 91: I. Nuages', 1, ['Claude Debussy', 'Someone Else']), album: { id: 'alb3', name: 'Debussy: Nocturnes' } }
    const out = await spotifyCandidates(fakeSpotify([karajan, karajan, other]), proposed)
    expect(out).toEqual([{ album: 'Debussy: La mer', albumId: 'alb2', year: '1964', artists: ['Berliner Philharmoniker', 'Herbert von Karajan'] }])
  })

  it('holds a near miss for the listener instead of linking it, and confirms or refuses it on their word', async () => {
    const repo = new Repo(memoryStore())
    await repo.recordings.put(rec)
    // Boulez credited, the Cleveland Orchestra not: maybe a different Boulez La mer.
    const near = t('m1', 'La mer, L. 109: I. De l’aube à midi sur la mer', 1, ['Claude Debussy', 'Chicago Symphony Orchestra', 'Pierre Boulez'])
    const out = await verifyRecording(repo, fakeSpotify([near]), 'rec1', proposed, 'now')
    expect(out.recording.verification).toBe('unconfirmed')
    expect(out.recording.spotify?.confidence).toBe('probable')
    const yes = await confirmMatch(repo, 'rec1', 'later')
    expect(yes.verification).toBe('verified')
    expect(yes.spotify?.confirmedByListener).toBe('later')
    expect(needsLook(yes)).toBe(false) // the listener's word is final, whatever the matcher version
  })

  it('never offers a refused album again, and looks once more for the right one', async () => {
    const repo = new Repo(memoryStore())
    await repo.recordings.put(rec)
    const spotify = fakeSpotify([t('m1', 'La mer, L. 109: I. De l’aube à midi sur la mer', 1)])
    await verifyRecording(repo, spotify, 'rec1', proposed, 'now')
    await repo.events.put({ id: 'e1', at: 'x', kind: 'heard', recordingId: 'rec1', workId: rec.workId, source: 'spotify-recent', playedAt: 'x' })
    await repo.events.put({ id: 'e2', at: 'x', kind: 'skipped', recordingId: 'rec1', workId: rec.workId, source: 'manual' })
    const r = await rejectMatch(repo, spotify, 'rec1', proposed, 'later')
    expect(r.rejectedAlbumIds).toEqual(['alb1'])
    expect(r.verification).toBe('not-found') // the only album Spotify had was the refused one
    expect(r.spotify).toBeUndefined()
    // Plays Spotify reported against the wrong album go with it; the listener's own mark stays.
    expect((await repo.events.all()).map((e) => e.id)).toEqual(['e2'])
  })

  it('looks again at a match an older matcher accepted, and drops what it wrongly inferred', async () => {
    const repo = new Repo(memoryStore())
    const wrong: Recording = { ...rec, verification: 'verified', checkedWith: 2, albumId: 'bee', spotify: { albumId: 'bee', albumName: 'Beethoven: Symphonies Nos. 4 & 7', albumUri: 'u', artistNames: [], trackIds: ['b1'], trackUris: [], confidence: 'strong', matchedAt: 'x' } }
    await repo.recordings.put(wrong)
    await repo.events.put({ id: 'e1', at: 'x', kind: 'heard', recordingId: 'rec1', workId: rec.workId, source: 'spotify-recent', playedAt: 'x' })
    expect(needsLook(wrong)).toBe(true)
    const out = await verifyRecording(repo, fakeSpotify([t('m2', 'La mer, L. 109: II. Jeux de vagues', 2)]), 'rec1', proposed, 'now')
    expect(out.recording).toMatchObject({ verification: 'verified', checkedWith: MATCHER_VERSION, albumId: 'alb1' })
    expect(out.recording.spotify?.trackNames).toEqual(['I. De l’aube à midi sur la mer', 'II. Jeux de vagues', 'III. Dialogue du vent et de la mer'])
    expect(await repo.events.all()).toEqual([])
  })

  it('keeps the listening when a re-check finds the very same tracks', async () => {
    const repo = new Repo(memoryStore())
    await repo.recordings.put(rec)
    const spotify = fakeSpotify([t('m2', 'La mer, L. 109: II. Jeux de vagues', 2)])
    await verifyRecording(repo, spotify, 'rec1', proposed, 'now')
    await repo.recordings.put({ ...(await repo.recordings.require('rec1')), checkedWith: 2 })
    await repo.events.put({ id: 'e1', at: 'x', kind: 'heard', recordingId: 'rec1', workId: rec.workId, source: 'spotify-recent', playedAt: 'x' })
    await verifyRecording(repo, spotify, 'rec1', proposed, 'later')
    expect((await repo.events.all()).map((e) => e.id)).toEqual(['e1'])
  })
})

describe('recently played', () => {
  const verified: Recording = { ...rec, verification: 'verified', spotify: { albumId: 'a', albumName: 'A', albumUri: 'u', artistNames: [], trackIds: ['m1', 'm2', 'm3'], trackUris: [], confidence: 'strong', matchedAt: 'x' } }
  const play = (id: string, at: string) => ({ played_at: at, track: t(id, 'x', 1) })

  it('counts most of a work as heard, a little as partial, and nothing unrelated', () => {
    const evs = playsToEvents([play('m1', '2026-10-08T19:00:00Z'), play('m2', '2026-10-08T19:10:00Z'), play('zz', '2026-10-08T19:20:00Z')], [verified], [], 'now')
    expect(evs).toHaveLength(1)
    expect(evs[0]).toMatchObject({ kind: 'heard', tracksPlayed: 2, tracksTotal: 3, source: 'spotify-recent', playedAt: '2026-10-08T19:00:00Z' })
    expect(playsToEvents([play('m3', '2026-10-08T19:00:00Z')], [verified], [], 'now')[0].kind).toBe('partial')
  })

  it('never records the same session twice, but upgrades a partial that was finished', () => {
    const first = playsToEvents([play('m1', '2026-10-08T19:00:00Z')], [verified], [], 'now')
    expect(first[0].kind).toBe('partial')
    expect(playsToEvents([play('m1', '2026-10-08T19:00:00Z')], [verified], first, 'now')).toEqual([])
    const later = playsToEvents([play('m1', '2026-10-08T19:00:00Z'), play('m2', '2026-10-08T19:12:00Z')], [verified], first, 'now')
    expect(later.map((e) => e.kind)).toEqual(['heard'])
    expect(playsToEvents([play('m1', '2026-10-08T19:00:00Z'), play('m2', '2026-10-08T19:12:00Z')], [verified], [...first, ...later] as ListeningEvent[], 'now')).toEqual([])
  })

  it('counts nothing against a near miss the listener hasn’t confirmed', () => {
    const near: Recording = { ...verified, verification: 'unconfirmed', spotify: { ...verified.spotify!, confidence: 'probable' } }
    expect(playsToEvents([play('m1', '2026-10-08T19:00:00Z'), play('m2', '2026-10-08T19:10:00Z')], [near], [], 'now')).toEqual([])
  })

  it('never calls a single-track work heard: thirty seconds of it looks the same to Spotify', () => {
    const one: Recording = { ...verified, spotify: { ...verified.spotify!, trackIds: ['s7'] } }
    expect(playsToEvents([play('s7', '2026-10-08T19:00:00Z')], [one], [], 'now').map((e) => e.kind)).toEqual(['partial'])
  })

  it('does not count a session twice when its first plays scroll out of the fifty', () => {
    const first = playsToEvents([play('m1', '2026-10-08T19:00:00Z'), play('m2', '2026-10-08T19:10:00Z'), play('m3', '2026-10-08T19:20:00Z')], [verified], [], 'now')
    expect(first.map((e) => e.kind)).toEqual(['heard'])
    // Later, only the last two of that session are still in recently-played.
    expect(playsToEvents([play('m2', '2026-10-08T19:10:00Z'), play('m3', '2026-10-08T19:20:00Z')], [verified], first, 'now')).toEqual([])
  })

  it('looks at recent plays once at a time, however many callers ask', async () => {
    const repo = new Repo(memoryStore())
    await repo.recordings.put(verified)
    const recentlyPlayed = vi.fn(async () => [play('m1', '2026-10-08T19:00:00Z'), play('m2', '2026-10-08T19:10:00Z')])
    const spotify = { connected: true, recentlyPlayed } as unknown as SpotifyClient
    const [a, b] = await Promise.all([syncRecentPlays(repo, spotify, 'now'), syncRecentPlays(repo, spotify, 'now')])
    expect(recentlyPlayed).toHaveBeenCalledTimes(1)
    expect([a, b]).toEqual([1, 1])
    expect(await repo.events.all()).toHaveLength(1)
  })

  it('treats a return days later as a new hearing', () => {
    const evs = playsToEvents([play('m1', '2026-10-08T19:00:00Z'), play('m2', '2026-10-08T19:10:00Z'), play('m1', '2026-10-10T09:00:00Z'), play('m2', '2026-10-10T09:10:00Z')], [verified], [], 'now')
    expect(evs.map((e) => e.kind)).toEqual(['heard', 'heard'])
  })
})

describe('the client', () => {
  it('refreshes an expired token once and retries', async () => {
    const s = memStorage()
    s.setItem('long-listen:spotify', JSON.stringify({ accessToken: 'old', refreshToken: 'r', expiresAt: 0, scope: '' }))
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('accounts.spotify.com')) return new Response(JSON.stringify({ access_token: 'new', expires_in: 3600 }))
      return new Response(JSON.stringify({ tracks: { items: [] } }))
    })
    const c = new SpotifyClient(() => 'client', fetchMock as unknown as typeof fetch, s)
    await c.searchTracks('debussy la mer boulez')
    const apiCall = fetchMock.mock.calls.find(([u]) => String(u).startsWith('https://api.spotify.com'))! as unknown as [string, RequestInit]
    expect((apiCall[1].headers as Record<string, string>).Authorization).toBe('Bearer new')
    expect(apiCall[0]).toContain('limit=10')
    expect(JSON.parse(s.getItem('long-listen:spotify')!).refreshToken).toBe('r') // kept when not rotated
  })

  it('keeps the sign-in through a passing outage, and only ends it when Spotify says it is over', async () => {
    const s = memStorage()
    s.setItem('long-listen:spotify', JSON.stringify({ accessToken: 'old', refreshToken: 'r', expiresAt: 0, scope: '' }))
    let tokenStatus = 503
    const fetchMock = vi.fn(async (url: string) => url.includes('accounts.spotify.com')
      ? new Response(JSON.stringify({ error: tokenStatus === 400 ? 'invalid_grant' : 'unavailable' }), { status: tokenStatus })
      : new Response(JSON.stringify({ tracks: { items: [] } })))
    const c = new SpotifyClient(() => 'client', fetchMock as unknown as typeof fetch, s)
    const told = vi.fn()
    c.onSignedOut(told)
    await expect(c.searchTracks('x')).rejects.toMatchObject({ reason: 'offline' })
    expect(c.connected).toBe(true) // a 503 is not a sign-out
    tokenStatus = 400 // six months on: invalid_grant
    await expect(c.searchTracks('x')).rejects.toMatchObject({ reason: 'signed-out' })
    expect(c.connected).toBe(false)
    expect(told).toHaveBeenCalledWith(expect.stringMatching(/six months/))
  })

  it('refreshes once for many callers, and uses a token another tab already refreshed', async () => {
    const s = memStorage()
    s.setItem('long-listen:spotify', JSON.stringify({ accessToken: 'old', refreshToken: 'r', expiresAt: 0, scope: '' }))
    const fetchMock = vi.fn(async (url: string) => url.includes('accounts.spotify.com')
      ? new Response(JSON.stringify({ access_token: 'new', refresh_token: 'r2', expires_in: 3600 }))
      : new Response(JSON.stringify({ tracks: { items: [] } })))
    const c = new SpotifyClient(() => 'client', fetchMock as unknown as typeof fetch, s)
    await Promise.all([c.searchTracks('a'), c.searchTracks('b'), c.searchTracks('c')])
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('accounts.spotify.com'))).toHaveLength(1)

    // Another tab refreshes and rotates; this one picks up its token rather than spending a stale refresh token.
    const other = memStorage()
    other.setItem('long-listen:spotify', JSON.stringify({ accessToken: 'old', refreshToken: 'r', expiresAt: 0, scope: '' }))
    const c2 = new SpotifyClient(() => 'client', fetchMock as unknown as typeof fetch, other)
    other.setItem('long-listen:spotify', JSON.stringify({ accessToken: 'fresh', refreshToken: 'r3', expiresAt: Date.now() + 3600_000, scope: '' }))
    fetchMock.mockClear()
    await c2.searchTracks('d')
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('accounts.spotify.com'))).toBe(false)
  })

  it('plays a work from its first movement, with shuffle off', async () => {
    const s = memStorage()
    s.setItem('long-listen:spotify', JSON.stringify({ accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() + 3600_000, scope: '' }))
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
    const c = new SpotifyClient(() => 'client', fetchMock as unknown as typeof fetch, s)
    await c.play(['spotify:track:1', 'spotify:track:2'])
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][]
    expect(calls[0][0]).toContain('me/player/shuffle?state=false')
    expect(JSON.parse(String(calls[1][1].body))).toMatchObject({ uris: ['spotify:track:1', 'spotify:track:2'], offset: { position: 0 } })
  })

  it('pauses and resumes without restarting, and shrugs at "already paused"', async () => {
    const s = memStorage()
    s.setItem('long-listen:spotify', JSON.stringify({ accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() + 3600_000, scope: '' }))
    let status = 204
    const fetchMock = vi.fn(async () => new Response(null, { status }))
    const c = new SpotifyClient(() => 'client', fetchMock as unknown as typeof fetch, s)
    await c.pause()
    await c.resume()
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][]
    expect(calls.map(([u, i]) => [u.split('v1/')[1], i.method, i.body])).toEqual([['me/player/pause', 'PUT', undefined], ['me/player/play', 'PUT', undefined]])
    status = 403
    await expect(c.pause()).resolves.toBeUndefined()
    status = 404
    await expect(c.resume()).rejects.toMatchObject({ reason: 'no-device' })
  })

  it('reads the player: the track, its length, and the device it’s on', async () => {
    const s = memStorage()
    s.setItem('long-listen:spotify', JSON.stringify({ accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() + 3600_000, scope: '' }))
    const body = { is_playing: true, progress_ms: 1000, device: { name: 'Galaxy S24' }, item: { id: 't2', name: 'II. Andante', duration_ms: 500_000, linked_from: { id: 'm2' } } }
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(body)))
    const c = new SpotifyClient(() => 'client', fetchMock as unknown as typeof fetch, s)
    expect(await c.nowPlaying()).toEqual({ trackId: 't2', linkedFromId: 'm2', trackName: 'II. Andante', isPlaying: true, progressMs: 1000, durationMs: 500_000, deviceName: 'Galaxy S24' })
    expect(String((fetchMock.mock.calls as unknown as [string][])[0][0])).toMatch(/v1\/me\/player$/)
    fetchMock.mockImplementationOnce(async () => new Response(null, { status: 204 }))
    expect(await c.nowPlaying()).toBeNull()
    fetchMock.mockImplementationOnce(async () => new Response(null, { status: 403 }))
    await expect(c.nowPlaying()).rejects.toMatchObject({ reason: 'signed-out' })
  })

  it('starts from a later movement when asked', async () => {
    const s = memStorage()
    s.setItem('long-listen:spotify', JSON.stringify({ accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() + 3600_000, scope: '' }))
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }))
    const c = new SpotifyClient(() => 'client', fetchMock as unknown as typeof fetch, s)
    await c.play(['spotify:track:1', 'spotify:track:2', 'spotify:track:3'], 2)
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][]
    expect(JSON.parse(String(calls[1][1].body)).offset).toEqual({ position: 2 })
  })

  it('names a device as you would say it', () => {
    expect(shortDevice('LG native TV OLED55G42LW', 'TV')).toBe('LG TV')
    expect(shortDevice('Galaxy S24', 'Smartphone')).toBe('Galaxy S24')
    expect(shortDevice('Gabriel’s MacBook Pro M3 Max', 'Computer')).toBe('Gabriel’s computer')
    expect(shortDevice('Sonos Arc Living Room Soundbar', undefined)).toBe('Sonos')
    expect(shortDevice('  ', 'TV')).toBeUndefined()
  })

  it('knows a relinked track as the one that was asked for', () => {
    const np = (trackId: string, isPlaying: boolean, linkedFromId?: string) => ({ trackId, linkedFromId, trackName: 'x', isPlaying, progressMs: 0, durationMs: 0 })
    expect(playbackOf(np('m2', true), ['m1', 'm2'])).toEqual({ index: 1, playing: true })
    expect(playbackOf(np('other', false, 'm1'), ['m1', 'm2'])).toEqual({ index: 0, playing: false })
    expect(playbackOf(np('zz', true), ['m1', 'm2'])).toBeNull()
    expect(playbackOf(null, ['m1'])).toBeNull()
  })

  it('reports signed-out without calling Spotify', async () => {
    const fetchMock = vi.fn()
    const c = new SpotifyClient(() => 'client', fetchMock as unknown as typeof fetch, memStorage())
    await expect(c.searchTracks('x')).rejects.toMatchObject({ reason: 'signed-out' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('the week as a Spotify playlist', () => {
  async function seeded() {
    const repo = new Repo(memoryStore())
    const ref = (ids: string[]) => ({ albumId: 'a', albumName: 'A', albumUri: 'u', artistNames: [], trackIds: ids, trackUris: ids.map((i) => `spotify:track:${i}`), confidence: 'strong' as const, matchedAt: 'x' })
    await repo.recordings.putMany([
      { id: 'r1', workId: 'w1', soloistIds: [], character: [], verification: 'verified', spotify: ref(['a1', 'a2']) },
      { id: 'r2', workId: 'w2', soloistIds: [], character: [], verification: 'not-found' },
      // A near miss waiting for the listener stays out of the playlist.
      { id: 'r4', workId: 'w4', soloistIds: [], character: [], verification: 'unconfirmed', spotify: { ...ref(['d1']), confidence: 'probable' } },
      { id: 'r3', workId: 'w3', soloistIds: [], character: [], verification: 'verified', spotify: ref(['c1']) },
    ])
    const item = (id: string, rid: string) => ({ id, workId: 'w', recordingId: rid, why: '', whyThisRecording: '', listenFor: [], proposed: { composer: 'X', work: 'Y', soloists: [] } })
    await repo.programmes.put({ id: 'p1', weekKey: '2026-W41', optionId: 'o', themeId: 't', explorationId: 'e', stage: 1, title: 'Colour', dek: 'Dek.', introduction: '', whyNow: '', historicalPlace: '', howTheyRelate: '', sections: [{ id: 's', role: 'start', heading: 'H', items: [item('i1', 'r1'), item('i2', 'r2'), item('i4', 'r4'), item('i3', 'r3')] }], comparisonIds: [], createdAt: 'x', promptVersion: 'v', model: 'm' })
    return repo
  }

  it('holds exactly the confirmed tracks, in programme order, and updates the same playlist later', async () => {
    const repo = await seeded()
    const writePlaylist = vi.fn(async (_n: string, _d: string, _u: string[], id?: string) => ({ id: id ?? 'pl1', url: 'https://open.spotify.com/playlist/pl1' }))
    const spotify = { writePlaylist } as unknown as SpotifyClient
    const first = await saveProgrammePlaylist(repo, spotify, 'p1', '5–11 October 2026')
    expect(writePlaylist.mock.calls[0][2]).toEqual(['spotify:track:a1', 'spotify:track:a2', 'spotify:track:c1'])
    expect(writePlaylist.mock.calls[0][0]).toBe('The Long Listen — Colour')
    expect(first).toMatchObject({ id: 'pl1', tracks: 3 })
    await saveProgrammePlaylist(repo, spotify, 'p1', '5–11 October 2026')
    expect(writePlaylist.mock.calls[1][3]).toBe('pl1')
  })

  it('keeps a saved playlist in step, and leaves it alone when it matches', async () => {
    const repo = await seeded()
    const writePlaylist = vi.fn(async (_n: string, _d: string, _u: string[], id?: string) => ({ id: id ?? 'pl1', url: 'https://open.spotify.com/playlist/pl1' }))
    const spotify = { writePlaylist } as unknown as SpotifyClient
    // No playlist saved yet: nothing to keep.
    expect(await keepPlaylistCurrent(repo, spotify, 'p1', 'w')).toBe(false)
    await saveProgrammePlaylist(repo, spotify, 'p1', 'w')
    expect(await keepPlaylistCurrent(repo, spotify, 'p1', 'w')).toBe(false)
    expect(writePlaylist).toHaveBeenCalledTimes(1)
    // The near miss is confirmed by the listener: the playlist catches up, in programme order.
    await confirmMatch(repo, 'r4')
    expect(await keepPlaylistCurrent(repo, spotify, 'p1', 'w')).toBe(true)
    expect(writePlaylist.mock.calls[1][2]).toEqual(['spotify:track:a1', 'spotify:track:a2', 'spotify:track:d1', 'spotify:track:c1'])
    expect(writePlaylist.mock.calls[1][3]).toBe('pl1')
  })

  it('asks for a reconnect when the sign-in predates playlist permission', async () => {
    const s = memStorage()
    s.setItem('long-listen:spotify', JSON.stringify({ accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() + 3600_000, scope: 'user-read-recently-played' }))
    const fetchMock = vi.fn()
    const c = new SpotifyClient(() => 'client', fetchMock as unknown as typeof fetch, s)
    await expect(c.writePlaylist('n', 'd', ['u'])).rejects.toThrow(/Reconnect Spotify/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('speaks of length in rounded words', () => {
    expect(aboutDuration(24 * 60_000)).toBe('about 24 minutes')
    expect(aboutDuration(71 * 60_000)).toBe('about 1 hour 10 minutes')
    expect(aboutDuration(undefined)).toBeUndefined()
  })
})
