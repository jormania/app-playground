// Audit: verification, recent plays, playlist and stand-in scenarios normal use
// doesn't hit. Each test asserts the correct behaviour and fails today.
import { describe, it, expect, vi } from 'vitest'
import { playsToEvents, saveProgrammePlaylist, verifyProgramme } from '../spotify/verify'
import { SpotifyClient, SpotifyUnavailable, type RecentPlay } from '../spotify/client'
import { Repo, memoryStore } from '../store/repo'
import { nextToAsk } from '../domain/landed'
import type { Comparison, ListeningEvent, ProposedRecording, Recording } from '../domain/types'
import type { SpotifyTrackLike } from '../spotify/match'

const ref = (ids: string[]) => ({ albumId: 'a', albumName: 'A', albumUri: 'u', artistNames: [], trackIds: ids, trackUris: ids.map((i) => `spotify:track:${i}`), confidence: 'strong' as const, matchedAt: 'x' })
const play = (id: string, at: string, extra: Record<string, unknown> = {}): RecentPlay =>
  ({ played_at: at, track: { id, name: id, uri: `spotify:track:${id}`, artists: [], ...extra } as SpotifyTrackLike })

function programmeWith(items: { id: string; rid: string; workId?: string }[]) {
  return {
    id: 'p1', weekKey: '2026-W41', optionId: 'o', themeId: 't', explorationId: 'e', stage: 1, title: 'Colour', dek: 'Dek.', introduction: '', whyNow: '', historicalPlace: '', howTheyRelate: '',
    sections: [{ id: 's', role: 'start', heading: 'H', items: items.map(({ id, rid, workId }) => ({ id, workId: workId ?? `w-${id}`, recordingId: rid, why: '', whyThisRecording: '', listenFor: [], proposed: { composer: 'X', work: 'Y', soloists: [] } })) }],
    comparisonIds: [], createdAt: 'x', promptVersion: 'v', model: 'm',
  } as const
}

const standIn = (itemId: string, curatorRid: string, standInRid: string, workId: string): Comparison => ({
  id: `cmp:p1:${itemId}`, workId, framing: '', whyBoth: '', origin: 'on-request', standIn: true, createdAt: 'x',
  perspectives: [
    { recordingId: curatorRid, proposed: { composer: 'X', work: 'Y', soloists: [] }, character: '' },
    { recordingId: standInRid, proposed: { composer: 'X', work: 'Y', conductor: 'Other', soloists: [] }, character: '' },
  ],
})

describe('audit: the same Spotify tracks confirmed for two recordings', () => {
  it('a play counts for every recording those tracks confirm, not just the last one loaded', () => {
    // Two programmes propose one performance, the curator spelling the orchestra
    // differently ("Wiener Philharmoniker" / "Vienna Philharmonic"): two recording
    // ids (performersKey folds names but does not translate them), one album.
    const recs: Recording[] = [
      { id: 'rec-a', workId: 'w', soloistIds: [], character: [], verification: 'verified', spotify: ref(['t1', 't2', 't3']) },
      { id: 'rec-b', workId: 'w', soloistIds: [], character: [], verification: 'verified', spotify: ref(['t1', 't2', 't3']) },
    ]
    const plays = [play('t1', '2026-10-09T20:00:00.000Z'), play('t2', '2026-10-09T20:10:00.000Z'), play('t3', '2026-10-09T20:20:00.000Z')]
    const out = playsToEvents(plays, recs, [], 'now')
    expect(out.filter((e) => e.kind === 'heard').map((e) => e.recordingId).sort()).toEqual(['rec-a', 'rec-b'])
  })
})

describe('audit: a play of a relinked track', () => {
  it('is counted by the id that was asked for (linked_from), as nowPlaying already does', () => {
    const recs: Recording[] = [{ id: 'r', workId: 'w', soloistIds: [], character: [], verification: 'verified', spotify: ref(['t1', 't2']) }]
    const plays = [
      play('x1', '2026-10-09T20:00:00.000Z', { linked_from: { id: 't1' } }),
      play('x2', '2026-10-09T20:10:00.000Z', { linked_from: { id: 't2' } }),
    ]
    expect(playsToEvents(plays, recs, [], 'now').map((e) => e.kind)).toEqual(['heard'])
  })
})

describe('audit: "hide what I skip" and the playlist, where a stand-in plays', () => {
  it('a stand-in the listener skipped leaves the playlist, as it leaves the page', async () => {
    const repo = new Repo(memoryStore())
    await repo.recordings.putMany([
      { id: 'r1', workId: 'w-i1', soloistIds: [], character: [], verification: 'verified', spotify: ref(['a1']) },
      { id: 'r2', workId: 'w-i2', soloistIds: [], character: [], verification: 'not-found', checkedWith: 99 },
      { id: 'r2s', workId: 'w-i2', soloistIds: [], character: [], verification: 'verified', spotify: ref(['s1', 's2']) },
    ])
    await repo.programmes.put(programmeWith([{ id: 'i1', rid: 'r1' }, { id: 'i2', rid: 'r2' }]) as never)
    await repo.comparisons.put(standIn('i2', 'r2', 'r2s', 'w-i2'))
    // Skipping on the programme page files the mark under the recording that plays: the stand-in (Programme.tsx playedId).
    const skip: ListeningEvent = { id: 'ev1', at: '2026-10-09T10:00:00.000Z', kind: 'skipped', recordingId: 'r2s', workId: 'w-i2', programmeId: 'p1', source: 'manual' }
    await repo.events.put(skip)
    const writePlaylist = vi.fn(async (_n: string, _d: string, _u: string[], id?: string) => ({ id: id ?? 'pl1', url: 'u' }))
    await saveProgrammePlaylist(repo, { writePlaylist } as unknown as SpotifyClient, 'p1', 'w', { hideSkipped: true })
    expect(writePlaylist.mock.calls[0][2]).toEqual(['spotify:track:a1'])
  })
})

describe('audit: "How did it land?" for a stand-in', () => {
  it('a stand-in Spotify marked heard is asked about, like any other work', () => {
    const p = programmeWith([{ id: 'i1', rid: 'r-curator', workId: 'w1' }])
    const heard: ListeningEvent = { id: 'e', at: 'now', kind: 'heard', recordingId: 'r-standin', workId: 'w1', source: 'spotify-recent', playedAt: '2026-10-09T20:00:00.000Z', playedUntil: '2026-10-09T20:40:00.000Z' }
    // nextToAsk is given only events, feedback, asked marks and programmes — the stand-in's id is in none of the items.
    const ask = nextToAsk([heard], [], new Set(), [p as never])
    expect(ask?.item.id).toBe('i1')
  })
})

describe('audit: one album that can’t be fetched stops the whole programme’s verification', () => {
  it('a per-recording failure (album 404) does not keep the other works from being confirmed', async () => {
    const repo = new Repo(memoryStore())
    const works = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot']
    const proposed = (w: string): ProposedRecording => ({ composer: 'Jean Sibelius', work: `${w} Suite`, conductor: 'Paavo Berglund', soloists: [] })
    const recs: Recording[] = works.map((w) => ({ id: `r-${w}`, workId: `w-${w}`, soloistIds: [], character: [], verification: 'unchecked' }))
    await repo.recordings.putMany(recs)
    const p = programmeWith(works.map((w) => ({ id: w, rid: `r-${w}` })))
    await repo.programmes.put({ ...p, sections: [{ ...p.sections[0], items: p.sections[0].items.map((i) => ({ ...i, proposed: proposed(i.id) })) }] } as never)
    const trackFor = (w: string): SpotifyTrackLike => ({ id: `t-${w}`, name: `${w} Suite`, uri: `spotify:track:t-${w}`, artists: [{ name: 'Jean Sibelius' }, { name: 'Paavo Berglund' }], album: { id: `alb-${w}`, name: `${w}` }, track_number: 1, disc_number: 1 })
    const spotify = {
      connected: true,
      searchTracks: vi.fn(async (q: string) => works.filter((w) => q.includes(w.toLowerCase())).map(trackFor)),
      album: vi.fn(async (id: string) => {
        // The first work's album is gone (region-locked or withdrawn): Spotify answers 404.
        if (id === 'alb-Alpha') throw new SpotifyUnavailable('failed', 'Spotify didn’t answer that one.')
        return { id, name: id, uri: `spotify:album:${id}`, artists: [] }
      }),
      albumTracks: vi.fn(async (id: string) => [trackFor(id.slice(4))]),
    } as unknown as SpotifyClient
    const done = await verifyProgramme(repo, spotify, 'p1')
    expect(done).toBe(5)
  })
})

describe('audit: a work on a large box set', () => {
  it('finds the work’s movements past the 200th track of an album', async () => {
    const s = new Map<string, string>([['long-listen:spotify', JSON.stringify({ accessToken: 'a', refreshToken: 'r', expiresAt: Date.now() + 3600_000, scope: '' })]])
    const storage = { getItem: (k: string) => s.get(k) ?? null, setItem: (k: string, v: string) => void s.set(k, v), removeItem: (k: string) => void s.delete(k) } as unknown as Storage
    const TOTAL = 260
    const fetchMock = vi.fn(async (url: string) => {
      const u = new URL(url)
      const offset = Number(u.searchParams.get('offset') ?? 0)
      const items = Array.from({ length: Math.min(50, TOTAL - offset) }, (_, i) => ({ id: `t${offset + i}`, name: `n${offset + i}`, uri: `spotify:track:t${offset + i}`, artists: [], track_number: offset + i + 1, disc_number: 1 }))
      return new Response(JSON.stringify({ items, next: offset + 50 < TOTAL ? 'more' : null }))
    })
    const c = new SpotifyClient(() => 'client', fetchMock as unknown as typeof fetch, storage)
    const tracks = await c.albumTracks('box')
    // workTracks looks for the matched track in this list; past 200 it falls back to one track alone.
    expect(tracks.some((t) => t.id === 't230')).toBe(true)
  })
})
