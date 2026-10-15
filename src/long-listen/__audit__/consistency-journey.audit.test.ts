// Consistency audit (13 October 2026): siblings of fixes made in one place and
// left open in another. Each test asserts the correct behaviour and fails today.
import { describe, it, expect, beforeEach } from 'vitest'
import { Journey } from '../curation/journey'
import { Repo, memoryStore } from '../store/repo'
import type { CuratorClient } from '../curation/api'
import type { Programme, Recording } from '../domain/types'
import { seasonContext } from '../curation/season'
import { season } from '../domain/season'
import { syncToNotion, type NotionCall } from '../notion/mirror'
import { confirmMatch, rejectMatch, spotifyCandidates, verifyRecording } from '../spotify/verify'
import type { SpotifyClient } from '../spotify/client'
import { fakeCurator, deferred, tick, themes, programme, item, FRENCH, OTHER } from './journey-audit-helpers'

let clock: Date
let repo: Repo
const at = (iso: string) => { clock = new Date(iso) }
const journey = (client: CuratorClient) => new Journey(repo, client, { now: () => clock })
const until = async (cond: () => boolean) => { for (let i = 0; i < 200 && !cond(); i++) await tick() }

beforeEach(() => {
  repo = new Repo(memoryStore())
  at('2026-10-08T09:00:00Z') // Thursday, 2026-W41
})

/** The first work Spotify lacked; a stand-in played it, was heard and loved — filed as Programme.tsx files it. */
async function heardThroughStandIn(j: Journey, p: Programme) {
  const debussy = p.sections[0].items[0]
  const rec = await repo.recordings.require(debussy.recordingId)
  await repo.recordings.put({ ...rec, verification: 'not-found' })
  await repo.recordings.put({ id: 'rec-standin', workId: debussy.workId, soloistIds: [], character: [], verification: 'verified', spotify: { albumId: 'a', albumName: 'A', albumUri: 'u', artistNames: [], trackIds: ['t'], trackUris: ['u'], confidence: 'strong', matchedAt: 'x', durationMs: 1_500_000 } })
  await repo.comparisons.put({
    id: `cmp:${p.id}:${debussy.id}`, workId: debussy.workId, framing: '', whyBoth: '', origin: 'on-request', standIn: true, createdAt: 'x',
    perspectives: [
      { recordingId: debussy.recordingId, proposed: debussy.proposed, character: '' },
      { recordingId: 'rec-standin', proposed: { composer: 'Claude Debussy', work: 'La mer', conductor: 'Simon Rattle', orchestra: 'Berliner Philharmoniker', soloists: [] }, character: '' },
    ],
  })
  await j.markListening({ recordingId: 'rec-standin', workId: debussy.workId }, 'heard', p.id)
  await j.giveFeedback({ target: { type: 'recording', id: 'rec-standin' }, programmeId: p.id, reaction: 'loved', note: 'The sea, at last.' })
  return debussy
}

function fakeNotion() {
  const calls: { path: string; method: string; body?: any }[] = []
  let n = 0
  const client: NotionCall = async <T,>(c: any): Promise<T> => {
    calls.push(c)
    if (c.method === 'GET') return { results: [] } as T
    return { id: `id${++n}` } as T
  }
  return { client, calls }
}

describe('a stand-in is the item: readers still asking only about the curator’s recording', () => {
  it('the Notion Journal row lists a work heard through a stand-in as heard, with what was said (mirror.ts journalProps)', async () => {
    const c = fakeCurator({ themes: () => themes(['Colour', 'B', 'C']), programme: () => programme('Colour', FRENCH) })
    const j = journey(c.client)
    const p = await j.choose((await j.ensureWeek()).optionIds[0])
    await heardThroughStandIn(j, p)
    const n = fakeNotion()
    await syncToNotion(n.client, repo, 'page', '2026-W41')
    const row = n.calls.find((x) => x.body?.properties?.Heard && JSON.stringify(x.body.properties.Name).includes('Colour'))
    expect(row).toBeTruthy()
    expect(JSON.stringify(row!.body.properties.Heard)).toContain('La mer')
    expect(JSON.stringify(row!.body.properties.Notes)).toContain('The sea, at last.')
  })
})

describe('the same "how did it land" merge, done two ways', () => {
  it('the season keeps what was said about the recording when the work was also spoken of (season.ts said() spreads overwrite)', async () => {
    const c = fakeCurator({ themes: () => themes(['Colour', 'B', 'C']), programme: () => programme('Colour', FRENCH) })
    const j = journey(c.client)
    const p = await j.choose((await j.ensureWeek()).optionIds[0])
    const debussy = p.sections[0].items[0]
    await j.markListening(debussy, 'heard', p.id)
    await j.giveFeedback({ target: { type: 'recording', id: debussy.recordingId }, programmeId: p.id, reaction: 'loved', note: 'Boulez’s clarity.' })
    await j.giveFeedback({ target: { type: 'work', id: debussy.workId }, programmeId: p.id, note: 'The sea as an orchestra.' })
    const ctx = await seasonContext(repo, season('2026-W41', 1, '2026-W42'), '2026-W42')
    const heard = ctx.heard.find((h) => h.work === 'La mer')!
    expect(heard.reaction).toBe('loved')
    expect(heard.said).toEqual(expect.arrayContaining(['Boulez’s clarity.', 'The sea as an orchestra.']))
  })
})

describe('re-read after the curator’s minute before writing', () => {
  it('a wish for next week written while the directions are being made is not cleared unread (journey.ts generateWeek)', async () => {
    await repo.savePreferences({ ...(await repo.preferences()), nextRequest: 'Sibelius' })
    const gate = deferred()
    const c = fakeCurator({ themes: async () => { await gate.promise; return themes(['A', 'B', 'C']) } })
    const week = journey(c.client).ensureWeek()
    await until(() => c.count('themes') > 0)
    expect(c.calls[0].payload.context.requestedNext).toBe('Sibelius')
    // Meanwhile, the listener changes the wish in the Notebook.
    await repo.savePreferences({ ...(await repo.preferences()), nextRequest: 'Nielsen, next' })
    gate.resolve()
    await week
    expect((await repo.preferences()).nextRequest).toBe('Nielsen, next')
  })

  it('choosing a returning theme does not write back the thread as it was before the curator answered (journey.ts startProgramme)', async () => {
    const gate = deferred()
    let continuity = 0
    const c = fakeCurator({
      themes: (_p, n) => (n === 1 ? themes(['Colour', 'B', 'C']) : themes(['Colour again', 'Y', 'Z'], { at: 0, themeId: thread.id })),
      programme: async (_p, n) => { if (n === 2) await gate.promise; return programme(n === 1 ? 'Colour' : 'Colour, again', n === 1 ? FRENCH : OTHER) },
      // The first closing fails (offline), the second — made while the programme is being written — answers.
      continuity: () => { if (++continuity === 1) throw new Error('offline'); return { reaction: 'Drawn in.', openQuestions: ['What is Debussy without the sea?'], adjacentTopics: [], nextDirections: ['Ravel’s ballets'], closingNote: 'c', promptVersion: 'c' } },
    })
    const thread = { id: '' }
    const j = journey(c.client)
    const p1 = await j.choose((await j.ensureWeek()).optionIds[0])
    thread.id = p1.themeId
    const themeId = thread.id
    at('2026-10-15T09:00:00Z') // W42
    const w42 = await journey(c.client).ensureWeek()
    const choosing = journey(c.client).choose(w42.optionIds[0])
    await until(() => c.count('programme') === 2)
    await journey(c.client).closeEndedExplorations()
    expect((await repo.themes.require(themeId)).openQuestions).toEqual(['What is Debussy without the sea?'])
    gate.resolve()
    await choosing
    const theme = await repo.themes.require(themeId)
    expect(theme.openQuestions).toEqual(['What is Debussy without the sea?'])
    expect(theme.nextDirections).toEqual(['Ravel’s ballets'])
    expect(theme.explorationIds).toHaveLength(2)
  })
})

describe('a fresh start while the curator thinks: every job that writes checks the generation, not only some', () => {
  async function chosen(extra: Record<string, (payload: any, n: number) => unknown>) {
    const c = fakeCurator({ themes: () => themes(['Colour', 'B', 'C']), programme: () => programme('Colour', FRENCH), ...extra })
    const j = journey(c.client)
    const p = await j.choose((await j.ensureWeek()).optionIds[0])
    return { c, j, p }
  }

  it('"Hear another perspective" (journey.compare) writes nothing back into the cleared journey', async () => {
    const gate = deferred()
    const { c, j, p } = await chosen({
      compare: async () => { await gate.promise; return { framing: 'f', whyBoth: 'w', current: { character: 'c' }, other: { conductor: 'Simon Rattle', orchestra: 'Berliner Philharmoniker', soloists: [], character: 'c' }, promptVersion: 'v' } },
    })
    const asked = j.compare(p.id, p.sections[0].items[0].id).catch(() => undefined)
    await until(() => c.count('compare') > 0)
    await repo.freshStart()
    gate.resolve()
    await asked
    expect(await repo.comparisons.all()).toEqual([])
    expect(await repo.recordings.all()).toEqual([])
    expect(await repo.works.all()).toEqual([])
  })

  it('"A little more context" (journey.explain) writes nothing back', async () => {
    const gate = deferred()
    const { c, j, p } = await chosen({ explain: async () => { await gate.promise; return { heading: 'h', body: 'b', promptVersion: 'v' } } })
    const asked = j.explain(p.id, p.sections[0].items[0].id).catch(() => undefined)
    await until(() => c.count('explain') > 0)
    await repo.freshStart()
    gate.resolve()
    await asked
    expect(await repo.explanations.all()).toEqual([])
  })

  it('further reading (journey.resources) writes nothing back', async () => {
    const gate = deferred()
    const { c, j, p } = await chosen({ resources: async () => { await gate.promise; return { resources: [{ kind: 'read', title: 't', url: 'https://example.org', source: 's', purpose: 'p' }], dropped: 0, promptVersion: 'v' } } })
    const asked = j.resources(p.id).catch(() => undefined)
    await until(() => c.count('resources') > 0)
    await repo.freshStart()
    gate.resolve()
    await asked
    expect(await repo.resources.all()).toEqual([])
    expect(await repo.marks.get(`resources:${p.id}`)).toBeUndefined()
  })

  it('the season in review (journey.writeSeasonReview) is not kept for a journey that no longer exists', async () => {
    const gate = deferred()
    const { c } = await chosen({ season: async () => { await gate.promise; return { title: 't', opening: 'o', threads: [], taste: '', open: '', again: [], closing: '', promptVersion: 'v' } } })
    at('2027-01-05T09:00:00Z') // season one is over
    const asked = journey(c.client).writeSeasonReview(1).catch(() => undefined)
    await until(() => c.count('season') > 0)
    await repo.freshStart()
    gate.resolve()
    await asked
    expect((await repo.marks.all()).filter((m) => m.id.startsWith('season:'))).toEqual([])
  })
})

describe('second hearings are matched by work identity, not by the curator’s spelling', () => {
  it('a second hearing taken up under a fuller title is marked offered, so it is never offered again (journey.ts startProgramme)', async () => {
    const c = fakeCurator({
      themes: () => themes(['Nordic', 'B', 'C']),
      programme: (_p, n) => (n === 1
        ? programme('Nordic', OTHER)
        : programme('Again', [item('Carl Nielsen', 'Symphony No. 4, Op. 29 “The Inextinguishable”', 'Herbert Blomstedt', 'San Francisco Symphony'), item('Jean Sibelius', 'Symphony No. 7', 'Osmo Vänskä', 'Lahti Symphony Orchestra')])),
    })
    const j = journey(c.client)
    const p = await j.choose((await j.ensureWeek()).optionIds[0])
    const nielsen = p.sections[1].items[0]
    await j.markListening(nielsen, 'heard', p.id)
    await j.giveFeedback({ target: { type: 'recording', id: nielsen.recordingId }, programmeId: p.id, reaction: 'interesting' })
    at('2026-11-05T09:00:00Z') // W45, four weeks on
    const j2 = journey(c.client)
    await j2.choose((await j2.ensureWeek()).optionIds[0])
    expect(c.calls.filter((x) => x.op === 'programme')[1].payload.secondHearings?.map((h: { work: string }) => h.work)).toEqual(['Symphony No. 4'])
    expect(await repo.marks.get(`again:${nielsen.workId}`)).toBeTruthy()
  })
})

describe('time zone: season dates are the listener’s, not UTC’s', () => {
  it('a taste note first seen at 01:30 on the season’s first Monday in Bucharest is new this season (season.ts seen())', async () => {
    const instant = '2026-10-04T22:30:00.000Z' // Monday 5 October, 01:30 in Bucharest — season one starts that day
    await repo.saveTaste({ ...(await repo.taste()), observations: [{ id: 'o1', facet: 'composer', subject: 'Sibelius', statement: 'Drawn to Sibelius.', stance: 'drawn-to', confidence: 'tentative', evidence: [], firstSeen: instant, lastSeen: instant } as any] })
    const ctx = await seasonContext(repo, season('2026-W41', 1, '2026-W42'), '2026-W42')
    expect(ctx.taste.newThisSeason.map((o) => o.statement)).toEqual(['Drawn to Sibelius.'])
  })
})

describe('surnames: "Strauss II" is Strauss everywhere, not only where displaySurname is used', () => {
  it('the search for a stand-in leads with the surname, not the generational suffix (verify.ts spotifyCandidates)', async () => {
    const queries: string[] = []
    const sp = { connected: true, searchTracks: async (q: string) => { queries.push(q); return [] } } as unknown as SpotifyClient
    await spotifyCandidates(sp, { composer: 'Johann Strauss II', work: 'An der schönen blauen Donau', soloists: [] })
    expect(queries.length).toBeGreaterThan(0)
    for (const q of queries) expect(q.toLowerCase()).toMatch(/^strauss /)
  })
})

describe('a Spotify re-check in flight does not overwrite the listener’s answer (verify.ts verifyRecording re-reads nothing)', () => {
  const proposed = { composer: 'Jean Sibelius', work: 'Tapiola', conductor: 'Osmo Vänskä', orchestra: 'Lahti Symphony Orchestra', soloists: [] }
  // A near miss decided by an older matcher: needsLook says look again.
  const near = (): Recording => ({
    id: 'r', workId: 'w', soloistIds: [], character: [], verification: 'unconfirmed', checkedWith: 1, albumId: 'a1',
    spotify: { albumId: 'a1', albumName: 'A', albumUri: 'u', artistNames: ['Osmo Vänskä'], trackIds: ['t1'], trackUris: ['u1'], confidence: 'probable', matchedAt: 'x' },
  })
  function slowSpotify() {
    const gate = deferred<unknown[]>()
    let searched = 0
    const sp = { connected: true, searchTracks: async () => { searched++; return gate.promise } } as unknown as SpotifyClient
    return { sp, release: () => gate.resolve([]), searched: () => searched }
  }

  it('"Yes, this is it" said while the background check runs stays said', async () => {
    await repo.recordings.put(near())
    const s = slowSpotify()
    const checking = verifyRecording(repo, s.sp, 'r', proposed)
    await until(() => s.searched() > 0)
    await confirmMatch(repo, 'r')
    s.release()
    await checking
    const r = await repo.recordings.require('r')
    expect(r.verification).toBe('verified')
    expect(r.spotify?.confirmedByListener).toBeTruthy()
  })

  it('"Not this one" said while the background check runs keeps the album refused', async () => {
    await repo.recordings.put(near())
    const s = slowSpotify()
    const checking = verifyRecording(repo, s.sp, 'r', proposed)
    await until(() => s.searched() > 0)
    await rejectMatch(repo, null, 'r', proposed)
    s.release()
    await checking
    expect((await repo.recordings.require('r')).rejectedAlbumIds ?? []).toContain('a1')
  })
})
