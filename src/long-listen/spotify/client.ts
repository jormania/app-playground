import { loadTokens, refresh, saveTokens, SIGNED_OUT_MESSAGE, SpotifyAuthError, type SpotifyTokens } from './auth'
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

export interface NowPlaying {
  trackId: string
  trackName: string
  isPlaying: boolean
  progressMs: number
}

export class SpotifyClient {
  private tokens: SpotifyTokens | null
  private refreshing: Promise<void> | null = null
  private signedOutListeners = new Set<(message: string) => void>()

  constructor(
    private readonly clientId: () => string,
    private readonly fetchImpl: typeof fetch = (...a) => fetch(...a),
    private readonly storage: Storage = localStorage,
  ) {
    this.tokens = loadTokens(storage)
  }

  /**
   * Signed in? A sign-in finished elsewhere (from the installed app, Spotify's
   * page returns in a browser tab) is picked up from storage.
   */
  get connected(): boolean {
    if (!this.tokens) this.tokens = loadTokens(this.storage)
    return Boolean(this.tokens)
  }

  /** Was this permission granted at sign-in? Older sign-ins lack the playlist one. */
  hasScope(scope: string): boolean {
    return Boolean(this.tokens?.scope.split(' ').includes(scope))
  }

  get currentTokens(): SpotifyTokens | null {
    return this.tokens
  }

  setTokens(t: SpotifyTokens | null) {
    this.tokens = t
    saveTokens(t, this.storage)
  }

  /** Told once, when Spotify ends the sign-in (six-monthly expiry, or access withdrawn). */
  onSignedOut(listener: (message: string) => void): () => void {
    this.signedOutListeners.add(listener)
    return () => { this.signedOutListeners.delete(listener) }
  }

  /**
   * One refresh at a time. Several calls finding the token expired together
   * (the verification pass, recent plays, the "now" poll) share it; if Spotify
   * rotates the refresh token, a second parallel refresh could spend the old
   * one. Another tab may have refreshed already — storage is read first.
   */
  private refreshOnce(): Promise<void> {
    this.refreshing ??= (async () => {
      try {
        const stored = loadTokens(this.storage)
        if (stored && stored.expiresAt > Date.now() && stored.accessToken !== this.tokens?.accessToken) {
          this.tokens = stored
          return
        }
        const base = stored ?? this.tokens!
        try {
          this.setTokens(await refresh(base, this.clientId(), this.fetchImpl))
        } catch (e) {
          if (!(e instanceof SpotifyAuthError)) throw new SpotifyUnavailable('offline', (e as Error).message)
          // Spotify says the sign-in is over. Unless another tab has just signed in again, forget it.
          const now = loadTokens(this.storage)
          if (now && now.refreshToken !== base.refreshToken) { this.tokens = now; return }
          this.setTokens(null)
          for (const l of this.signedOutListeners) l(SIGNED_OUT_MESSAGE)
          throw new SpotifyUnavailable('signed-out', SIGNED_OUT_MESSAGE)
        }
      } finally {
        this.refreshing = null
      }
    })()
    return this.refreshing
  }

  private async token(): Promise<string> {
    if (!this.connected) throw new SpotifyUnavailable('signed-out', 'Connect Spotify in Settings to check recordings.')
    if (Date.now() >= this.tokens!.expiresAt) await this.refreshOnce()
    if (!this.tokens) throw new SpotifyUnavailable('signed-out', SIGNED_OUT_MESSAGE)
    return this.tokens.accessToken
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

  /** Settings → "Test Spotify": who is signed in, and which devices could play. */
  async me(): Promise<{ name: string; id: string }> {
    const d = await this.get<{ display_name?: string; id: string }>('me')
    return { name: d.display_name || d.id, id: d.id }
  }

  async devices(): Promise<{ name: string; type: string; active: boolean }[]> {
    const d = await this.get<{ devices?: { name: string; type: string; is_active: boolean }[] }>('me/player/devices')
    return (d.devices ?? []).map((x) => ({ name: x.name, type: x.type, active: x.is_active }))
  }

  /** What's playing now, or null — for the listening view's "now" marker. */
  async nowPlaying(): Promise<NowPlaying | null> {
    const res = await this.request('me/player/currently-playing')
    if (res.status === 204 || !res.ok) return null
    const d = await res.json().catch(() => null) as { item?: { id: string; name: string } | null; is_playing?: boolean; progress_ms?: number } | null
    if (!d?.item) return null
    return { trackId: d.item.id, trackName: d.item.name, isPlaying: Boolean(d.is_playing), progressMs: d.progress_ms ?? 0 }
  }

  /** A private playlist of exactly these tracks. Replaces the tracks when `id` is given. */
  async writePlaylist(name: string, description: string, uris: string[], id?: string): Promise<{ id: string; url: string }> {
    if (!this.hasScope('playlist-modify-private')) {
      throw new SpotifyUnavailable('signed-out', 'Reconnect Spotify in Settings to let the app make playlists.')
    }
    let playlistId = id
    let url = id ? `https://open.spotify.com/playlist/${id}` : ''
    if (!playlistId) {
      const res = await this.request('me/playlists', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.slice(0, 100), description: description.slice(0, 300), public: false }),
      })
      if (!res.ok) throw new SpotifyUnavailable('failed', 'Spotify couldn’t make the playlist.')
      const d = await res.json() as { id: string; external_urls?: { spotify?: string } }
      playlistId = d.id
      url = d.external_urls?.spotify ?? `https://open.spotify.com/playlist/${d.id}`
    }
    // PUT replaces whatever was there; Spotify takes up to 100 per call.
    const first = await this.request(`playlists/${playlistId}/items`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ uris: uris.slice(0, 100) }),
    })
    if (!first.ok) throw new SpotifyUnavailable('failed', 'Spotify couldn’t fill the playlist.')
    for (let i = 100; i < uris.length; i += 100) {
      await this.request(`playlists/${playlistId}/items`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ uris: uris.slice(i, i + 100) }) })
    }
    return { id: playlistId!, url }
  }

  /**
   * Start the exact tracks on the listener's active Spotify device (Premium),
   * from the first movement, in order. A device left on shuffle would start a
   * symphony at a random movement, so shuffle is turned off first — that is
   * the one setting of theirs this changes, and only when they press Play.
   */
  async play(trackUris: string[]): Promise<void> {
    await this.request('me/player/shuffle?state=false', { method: 'PUT' }).catch(() => undefined)
    const res = await this.request('me/player/play', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ uris: trackUris, offset: { position: 0 }, position_ms: 0 }),
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
