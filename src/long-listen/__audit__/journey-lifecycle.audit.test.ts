import { describe, it, expect, beforeEach } from 'vitest'
import { Journey } from '../curation/journey'
import { Repo, memoryStore } from '../store/repo'
import { CuratorUnavailable, type CuratorClient } from '../curation/api'
import { fakeCurator, deferred, tick, themes, programme, FRENCH, MORE, OTHER } from './journey-audit-helpers'

let clock: Date
let repo: Repo
const at = (iso: string) => { clock = new Date(iso) }
const journey = (client: CuratorClient) => new Journey(repo, client, { now: () => clock })
const continuity = (tag: string) => ({ reaction: `reaction ${tag}`, openQuestions: [`q ${tag}`], adjacentTopics: [], nextDirections: [`next ${tag}`], closingNote: `closed ${tag}`, promptVersion: 'c' })

beforeEach(() => {
  repo = new Repo(memoryStore())
  at('2026-10-08T09:00:00Z') // Thursday, 2026-W41
})

describe('a path taken from Threads that the curator could not make', () => {
  it('does not leave the new week with no directions for good', async () => {
    const c = fakeCurator({
      themes: (_p, n) => themes(n === 1 ? ['A', 'Night music', 'C'] : ['D', 'E', 'F']),
      programme: (_p, n) => { if (n === 2) throw new CuratorUnavailable('offline', 'offline'); return programme('P', FRENCH) },
      continuity: () => continuity('w41'),
      taste: () => ({ observations: [], questions: [], promptVersion: 't' }),
    })
    const j = journey(c.client)
    const w1 = await j.ensureWeek()
    await j.choose(w1.optionIds[0])

    // Monday of the next week, straight to Threads → "Take this path now" (Threads.tsx: weekWithoutDirections, then takeOpenPath).
    at('2026-10-12T07:00:00Z')
    const j2 = journey(c.client)
    await j2.weekWithoutDirections()
    await expect(j2.takeOpenPath(w1.optionIds[1])).rejects.toThrow()

    // Back on This week: there should be three directions to choose from (or at least a programme).
    const w2 = await j2.ensureWeek()
    expect(w2.programmeId ?? (w2.optionIds.length === 3 ? 'directions' : undefined)).toBeTruthy()
  })
})

describe('closing two visits to one thread together', () => {
  it('leaves the thread as the latest visit closed it, whichever curator call answers last', async () => {
    let themeId = ''
    const slowOlder = deferred()
    let failClose = true
    const c = fakeCurator({
      themes: (payload, n) => {
        if (n === 1) return themes(['Colour', 'B', 'C'])
        themeId = payload.context.threads[0].themeId
        return themes(['Colour again', 'E', 'F'], { at: 0, themeId })
      },
      programme: (_p, n) => programme(n === 1 ? 'Colour' : 'Colour, again', n === 1 ? FRENCH : MORE),
      continuity: async (p) => {
        if (failClose) throw new CuratorUnavailable('busy', 'busy')
        if (p.exploration.weekKey === '2026-W41') { await slowOlder.promise; return continuity('w41') }
        return continuity('w42')
      },
      taste: () => ({ observations: [], questions: [], promptVersion: 't' }),
    })
    const j = journey(c.client)
    await j.choose((await j.ensureWeek()).optionIds[0])

    at('2026-10-15T09:00:00Z') // W42: closing W41 fails (busy) — retried next time
    const j2 = journey(c.client)
    const w2 = await j2.ensureWeek()
    await j2.choose(w2.optionIds[0]) // the thread returns

    at('2026-10-22T09:00:00Z') // W43: both visits close, side by side; the older answers last
    failClose = false
    const j3 = journey(c.client)
    const week = j3.closeEndedExplorations()
    await tick(); await tick()
    slowOlder.resolve()
    await week
    const theme = await repo.themes.require(themeId)
    expect(theme.nextDirections).toEqual(['next w42'])
    expect(theme.openQuestions).toEqual(['q w42'])
  })
})

describe('a fresh start while the curator is reading taste', () => {
  it('does not write the old feedback and taste back into the cleared journey', async () => {
    const gate = deferred()
    const c = fakeCurator({
      taste: async () => {
        await gate.promise
        return { observations: [{ facet: 'orchestral-sound', subject: 'colour', statement: 'Drawn to colour.', stance: 'drawn-to', confidence: 'tentative', evidence: [] }], questions: [], promptVersion: 't' }
      },
    })
    const j = journey(c.client)
    await j.giveFeedback({ target: { type: 'programme', id: 'prog_old' }, reaction: 'loved', note: 'Lovely week.' })
    const reading = j.interpretPendingFeedback()
    await tick()
    await repo.freshStart() // Settings → "Start again from nothing"
    gate.resolve()
    await reading.catch(() => {})
    expect(await repo.feedback.all()).toEqual([])
    expect((await repo.taste()).observations).toEqual([])
  })
})

describe('a sitting asked for twice the same evening', () => {
  it('a second sitting with other words, asked while the first is written, gets its own evening', async () => {
    const gate = deferred()
    const c = fakeCurator({
      programme: async (p) => { if (p.sitting.request === 'quiet') await gate.promise; return programme(`Evening: ${p.sitting.request}`, p.sitting.request === 'quiet' ? FRENCH : OTHER) },
    })
    const j = journey(c.client)
    const first = j.sitting('quiet', 1)
    await tick()
    const second = j.sitting('loud and Nordic', 2)
    gate.resolve()
    const [a, b] = await Promise.all([first, second])
    expect(b.sitting).toEqual({ request: 'loud and Nordic', hours: 2 })
    expect(a.id).not.toBe(b.id)
  })
})
