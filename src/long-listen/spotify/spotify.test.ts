import { describe, it, expect, vi } from 'vitest'
import { beginSignIn, completeSignIn, challengeFor, isCallback, SpotifyAuthError } from './auth'
import { verifyRecording, playsToEvents, forgetMatch } from './verify'
import { SpotifyClient } from './client'
import { Repo, memoryStore } from '../store/repo'
import type { Recording, ProposedRecording, ListeningEvent } from '../domain/types'
import type { SpotifyTrackLike } from './match'

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
  ({ id, name, uri: `spotify:track:${id}`, artists: artists.map((a) => ({ name: a })), album: { id: 'alb1', name: 'Debussy: La mer; Nocturnes' }, track_number: n, disc_number: 1 })

function fakeSpotify(search: SpotifyTrackLike[]) {
  return {
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
  })

  it('says not found rather than link someone else’s La mer', async () => {
    const repo = new Repo(memoryStore())
    await repo.recordings.put(rec)
    const karajan = t('k1', 'La mer, L. 109: I. De l’aube à midi sur la mer', 1, ['Claude Debussy', 'Berliner Philharmoniker', 'Herbert von Karajan'])
    const out = await verifyRecording(repo, fakeSpotify([karajan]), 'rec1', proposed, 'now')
    expect(out.recording.verification).toBe('not-found')
    expect(out.recording.spotify).toBeUndefined()
  })

  it('can forget a match so it is looked for again', async () => {
    const repo = new Repo(memoryStore())
    await repo.recordings.put(rec)
    await verifyRecording(repo, fakeSpotify([t('m1', 'La mer, L. 109: I. De l’aube à midi sur la mer', 1)]), 'rec1', proposed, 'now')
    await forgetMatch(repo, 'rec1')
    const r = await repo.recordings.require('rec1')
    expect(r.verification).toBe('unchecked')
    expect(r.spotify).toBeUndefined()
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

  it('reports signed-out without calling Spotify', async () => {
    const fetchMock = vi.fn()
    const c = new SpotifyClient(() => 'client', fetchMock as unknown as typeof fetch, memStorage())
    await expect(c.searchTracks('x')).rejects.toMatchObject({ reason: 'signed-out' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
