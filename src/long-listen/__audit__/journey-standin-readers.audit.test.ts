import { describe, it, expect, beforeEach } from 'vitest'
import { Journey } from '../curation/journey'
import { Repo, memoryStore } from '../store/repo'
import type { CuratorClient } from '../curation/api'
import type { Programme } from '../domain/types'
import { seasonContext } from '../curation/season'
import { season } from '../domain/season'
import { fakeCurator, themes, programme, FRENCH } from './journey-audit-helpers'

let clock: Date
let repo: Repo
const at = (iso: string) => { clock = new Date(iso) }
const journey = (client: CuratorClient) => new Journey(repo, client, { now: () => clock })

beforeEach(() => {
  repo = new Repo(memoryStore())
  at('2026-10-08T09:00:00Z') // Thursday, 2026-W41
})

/** A programme whose first work Spotify lacked: a stand-in played it, was heard and loved — filed where Programme.tsx files it now. */
async function heardThroughStandIn(j: Journey, p: Programme) {
  const debussy = p.sections[0].items[0]
  const rec = await repo.recordings.require(debussy.recordingId)
  await repo.recordings.put({ ...rec, verification: 'not-found' })
  await repo.recordings.put({ id: 'rec-standin', workId: debussy.workId, soloistIds: [], character: [], verification: 'verified', spotify: { albumId: 'a', albumName: 'A', albumUri: 'u', artistNames: [], trackIds: ['t'], trackUris: ['u'], confidence: 'strong', matchedAt: 'x' } })
  await repo.comparisons.put({
    id: `cmp:${p.id}:${debussy.id}`, workId: debussy.workId, framing: '', whyBoth: '', origin: 'on-request', standIn: true, createdAt: 'x',
    perspectives: [
      { recordingId: debussy.recordingId, proposed: debussy.proposed, character: '' },
      { recordingId: 'rec-standin', proposed: { composer: 'Claude Debussy', work: 'La mer', conductor: 'Simon Rattle', orchestra: 'Berliner Philharmoniker', soloists: [] }, character: '' },
    ],
  })
  // Programme.tsx: mark() and the FeedbackPanel both use playedId = the stand-in's recording.
  await j.markListening({ recordingId: 'rec-standin', workId: debussy.workId }, 'heard', p.id)
  await j.giveFeedback({ target: { type: 'recording', id: 'rec-standin' }, programmeId: p.id, reaction: 'loved', note: 'The sea, at last.' })
  return debussy
}

describe('a work heard through a stand-in', () => {
  it('reaches the continuity planner as heard, with what was said', async () => {
    const c = fakeCurator({
      themes: () => themes(['Colour', 'B', 'C']),
      programme: () => programme('Colour', FRENCH),
      continuity: () => ({ reaction: 'r', openQuestions: [], adjacentTopics: [], nextDirections: [], closingNote: 'c', promptVersion: 'c' }),
    })
    const j = journey(c.client)
    const p = await j.choose((await j.ensureWeek()).optionIds[0])
    await heardThroughStandIn(j, p)
    at('2026-10-15T09:00:00Z')
    await journey(c.client).closeEndedExplorations()
    const sent = c.calls.find((x) => x.op === 'continuity')!.payload.programme.items[0]
    expect(sent).toMatchObject({ work: 'La mer', state: 'heard', reaction: 'loved' })
  })

  it('counts as heard in the season in review', async () => {
    const c = fakeCurator({ themes: () => themes(['Colour', 'B', 'C']), programme: () => programme('Colour', FRENCH) })
    const j = journey(c.client)
    const p = await j.choose((await j.ensureWeek()).optionIds[0])
    await heardThroughStandIn(j, p)
    const ctx = await seasonContext(repo, season('2026-W41', 1, '2026-W42'), '2026-W42')
    expect(ctx.heard.map((h) => h.work)).toContain('La mer')
  })
})

describe('the curator’s context, for a work heard through a stand-in', () => {
  it('lists the stand-in in recent listening, credited to who played, and offers an "interesting" one for a second hearing', async () => {
    const { buildContext } = await import('../curation/context')
    const { weekOf } = await import('../domain/week')
    const c = fakeCurator({ themes: () => themes(['Colour', 'B', 'C']), programme: () => programme('Colour', FRENCH) })
    const j = journey(c.client)
    const p = await j.choose((await j.ensureWeek()).optionIds[0])
    await heardThroughStandIn(j, p)
    await j.giveFeedback({ target: { type: 'recording', id: 'rec-standin' }, programmeId: p.id, reaction: 'interesting' })
    const ctx = await buildContext(repo, weekOf(new Date('2026-11-12T09:00:00Z')))
    expect(ctx.recentListening.find((r) => r.work === 'La mer')).toMatchObject({ recording: expect.stringContaining('Simon Rattle'), state: 'heard' })
    expect(ctx.secondHearings.map((x) => x.work)).toContain('La mer')
  })
})
