import { describe, it, expect, beforeEach } from 'vitest'
import { Journey } from '../curation/journey'
import { Repo, memoryStore } from '../store/repo'
import type { CuratorClient } from '../curation/api'
import { fakeCurator, deferred, tick, themes, programme, FRENCH, MORE, EVENING, OTHER } from './journey-audit-helpers'

let clock: Date
let repo: Repo
const at = (iso: string) => { clock = new Date(iso) }
const journey = (client: CuratorClient) => new Journey(repo, client, { now: () => clock })

beforeEach(() => {
  repo = new Repo(memoryStore())
  at('2026-10-08T09:00:00Z') // Thursday, 2026-W41
})

describe('stand-in repair racing the taste reading at app start', () => {
  it('a taste reading in flight does not move the repaired feedback back to the curator’s recording', async () => {
    // services.tsx starts repairStandInFeedback() and interpretPendingFeedback() in the same tick on load.
    await repo.recordings.put({ id: 'rec-boult', workId: 'w-rvw6', soloistIds: [], character: [], verification: 'not-found' })
    await repo.recordings.put({ id: 'rec-brabbins', workId: 'w-rvw6', soloistIds: [], character: [], verification: 'verified', spotify: { albumId: 'a', albumName: 'A', albumUri: 'u', artistNames: [], trackIds: ['t'], trackUris: ['u'], confidence: 'strong', matchedAt: 'x' } })
    await repo.comparisons.put({
      id: 'cmp:p1:i1', workId: 'w-rvw6', framing: '', whyBoth: '', origin: 'on-request', standIn: true, createdAt: 'x',
      perspectives: [
        { recordingId: 'rec-boult', proposed: { composer: 'Ralph Vaughan Williams', work: 'Symphony No. 6', conductor: 'Sir Adrian Boult', soloists: [] }, character: '' },
        { recordingId: 'rec-brabbins', proposed: { composer: 'Ralph Vaughan Williams', work: 'Symphony No. 6', conductor: 'Martyn Brabbins', soloists: [] }, character: '' },
      ],
    })
    // Unread (not yet interpreted) — exactly the feedback a first load after the release would hold.
    await repo.feedback.put({ id: 'fb1', at: '2026-10-07T20:00:00Z', target: { type: 'recording', id: 'rec-boult' }, reaction: 'loved', note: 'Glorious.' })

    const gate = deferred()
    const c = fakeCurator({ taste: async () => { await gate.promise; return { observations: [], questions: [], promptVersion: 't' } } })
    const j = journey(c.client)
    const reading = j.interpretPendingFeedback()
    await tick() // the taste reader has read the feedback and is waiting on the curator
    expect(await j.repairStandInFeedback()).toBe(1)
    gate.resolve()
    await reading

    const fb = await repo.feedback.require('fb1')
    expect(fb.interpretedAt).toBeTruthy()
    expect(fb.target).toEqual({ type: 'recording', id: 'rec-brabbins' })
  })
})

describe('two companions on one thread at once', () => {
  it('"more of this theme" and a sitting made while it is being written both stay on the thread', async () => {
    const gate = deferred()
    const c = fakeCurator({
      themes: () => themes(['French colour', 'B', 'C']),
      programme: async (_p, n) => {
        if (n === 1) return programme('French colour', FRENCH)
        if (n === 2) { await gate.promise; return programme('More colour', MORE) }
        return programme('Tonight', EVENING)
      },
    })
    const j = journey(c.client)
    const first = await j.choose((await j.ensureWeek()).optionIds[0])
    const more = j.extendProgramme(first.id) // the curator takes a minute
    await tick()
    const tonight = await j.sitting('something quiet', 1) // meanwhile, from the same page
    gate.resolve()
    const extra = await more
    const ex = await repo.explorations.require(first.explorationId)
    expect(ex.extraProgrammeIds?.sort()).toEqual([extra.id, tonight.id].sort())
  })

  it('an extension finishing after a change of direction leaves the old exploration set aside', async () => {
    const gate = deferred()
    const c = fakeCurator({
      themes: () => themes(['French colour', 'Nordic', 'C']),
      programme: async (p, n) => {
        if (n === 1) return programme('French colour', FRENCH)
        if (p.extension) { await gate.promise; return programme('More colour', MORE) }
        return programme('Nordic', OTHER)
      },
    })
    const j = journey(c.client)
    const w = await j.ensureWeek()
    const first = await j.choose(w.optionIds[0])
    const more = j.extendProgramme(first.id)
    await tick()
    await j.changeDirection(w.optionIds[1])
    gate.resolve()
    await more
    expect((await repo.explorations.require(first.explorationId)).setAside).toBe(true)
  })
})

describe('choosing and a sitting at once, from This week', () => {
  it('never leaves a programme that is neither the week’s, set aside, nor on its thread', async () => {
    const gate = deferred()
    const c = fakeCurator({
      themes: () => themes(['French colour', 'B', 'C']),
      programme: async (p) => {
        if (!p.sitting) { await gate.promise; return programme('French colour', FRENCH) }
        return programme('Tonight', EVENING)
      },
    })
    const j = journey(c.client)
    const w = await j.ensureWeek()
    const chosen = j.choose(w.optionIds[0]) // "Listen this way →", curator thinking
    await tick()
    await j.sitting('quiet', 1) // SittingCard on the same screen is not disabled meanwhile
    gate.resolve()
    await chosen.catch(() => {})

    const week = await repo.weeks.require('2026-W41')
    const accounted = new Set([week.programmeId, ...week.setAsideProgrammeIds])
    const live = (await repo.programmes.all()).filter((p) => !p.extends && !accounted.has(p.id))
    expect(live.map((p) => p.title)).toEqual([])
    const activeExplorations = (await repo.explorations.all()).filter((e) => e.weekKey === '2026-W41' && !e.setAside)
    expect(activeExplorations).toHaveLength(1)
  })
})
