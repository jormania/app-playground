import { loadTokens, refresh, saveTokens, SpotifyAuthError, type SpotifyTokens } from './auth'
import type { SpotifyTrackLike } from './match'

/**
 * The few Spotify Web API calls the app makes, as of the February 2026 changes:
 * search pages hold at most ten results, `label` is gone from albums (the ℗
 * line in `copyrights` stands in), and batch lookups are gone — so everything
 * here is one id at a time. Development-mode apps need a Premium account on
 * the owner's side, which a single-listener app has anyway.
 */
const API = 'https://api.spotify.com/v1/'

export class SpotifyUnavailable extends Error {
  constructor(readonly reason: 'signed-out' | 'busy' | 'offline' | 'failed' | 'no-device', message: string) {
    super(message)
  }
}

export interface SpotifyAlbum {
  id: string
  name: string
  uri: string
  release_date?: string
  images?: { url: string; width?: number }[]
  artists: { name: string }[]
  copyrights?: { text: string; type: string }[]
}

export interface RecentPlay {
  played_at: string
  track: SpotifyTrackLike
}

export class SpotifyClient {
  private tokens: SpotifyTokens | null

  constructor(
    private readonly clientId: () => string,
    private readonly fetchImpl: typeof fetch = (...a) => fetch(...a),
    private readonly storage: Storage = localStorage,
  ) {
    this.tokens = loadTokens(storage)
  }

  get connected(): boolean {
    return Boolean(this.tokens)
  }

  setTokens(t: SpotifyTokens | null) {
    this.tokens = t
    saveTokens(t, this.storage)
  }

  private async token(): Promise<string> {
    if (!this.tokens) throw new SpotifyUnavailable('signed-out', 'Connect Spotify in Settings to check recordings.')
    if (Date.now() >= this.tokens.expiresAt) {
      try {
        this.setTokens(await refresh(this.tokens, this.clientId(), this.fetchImpl))
      } catch (e) {
        if (e instanceof SpotifyAuthError) this.setTokens(null)
        throw new SpotifyUnavailable('signed-out', 'Spotify needs you to connect again.')
      }
    }
    return this.tokens!.accessToken
  }

  private async request(path: string, init: RequestInit = {}, retried = false): Promise<Response> {
    let res: Response
    try {
      res = await this.fetchImpl(API + path, { ...init, headers: { ...(init.headers ?? {}), Authorization: `Bearer ${await this.token()}` } })
    } catch (e) {
      if (e instanceof SpotifyUnavailable) throw e
      throw new SpotifyUnavailable('offline', 'Spotify can’t be reached right now.')
    }
    if (res.status === 401 && !retried && this.tokens) {
      this.tokens = { ...this.tokens, expiresAt: 0 }
      return this.request(path, init, true)
    }
    if (res.status === 429) throw new SpotifyUnavailable('busy', 'Spotify asked us to slow down. Try again in a little while.')
    return res
  }

  private async get<T>(path: string): Promise<T> {
    const res = await this.request(path)
    if (!res.ok) throw new SpotifyUnavailable('failed', 'Spotify didn’t answer that one.')
    return (await res.json()) as T
  }

  async searchTracks(q: string): Promise<SpotifyTrackLike[]> {
    const data = await this.get<{ tracks?: { items: SpotifyTrackLike[] } }>(`search?${new URLSearchParams({ q, type: 'track', limit: '10' })}`)
    return data.tracks?.items ?? []
  }

  album(id: string): Promise<SpotifyAlbum> {
    return this.get<SpotifyAlbum>(`albums/${encodeURIComponent(id)}`)
  }

  async albumTracks(id: string): Promise<SpotifyTrackLike[]> {
    const out: SpotifyTrackLike[] = []
    let offset = 0
    for (let page = 0; page < 4; page++) {
      const data = await this.get<{ items: SpotifyTrackLike[]; next: string | null }>(`albums/${encodeURIComponent(id)}/tracks?limit=50&offset=${offset}`)
      out.push(...data.items)
      if (!data.next) break
      offset += 50
    }
    return out
  }

  async recentlyPlayed(): Promise<RecentPlay[]> {
    const data = await this.get<{ items: RecentPlay[] }>('me/player/recently-played?limit=50')
    return data.items ?? []
  }

  /** Start the exact tracks on the listener's active Spotify device (Premium). */
  async play(trackUris: string[]): Promise<void> {
    const res = await this.request('me/player/play', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ uris: trackUris }),
    })
    if (res.status === 404) throw new SpotifyUnavailable('no-device', 'Open Spotify on a device first, then try again.')
    if (!res.ok) throw new SpotifyUnavailable('failed', 'Spotify couldn’t start playback.')
  }
}

/** The web link for a track or album — opens the app on a phone. Needs no sign-in. */
export function openUrl(kind: 'track' | 'album', id: string): string {
  return `https://open.spotify.com/${kind}/${id}`
}

/** A Spotify search page for an unverified proposal: a search, never a claim. */
export function searchUrl(q: string): string {
  return `https://open.spotify.com/search/${encodeURIComponent(q)}`
}
