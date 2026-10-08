import { describe, it, expect, beforeEach } from 'vitest'
import { Journey } from './journey'
import { Repo, memoryStore } from '../store/repo'
import type { CuratorClient, CuratedItem, ProgrammeResponse, ThemesResponse } from './api'
import { CuratorUnavailable } from './api'
import { buildContext } from './context'
import { weekOf } from '../domain/week'

// A curator stand-in: records every call, answers from per-op scripts.
function fakeCurator(script: Partial<Record<string, (payload: any, n: number) => unknown>>) {
  const calls: { op: string; payload: any }[] = []
  const client: CuratorClient = {
    async call<T>(op: string, payload: unknown): Promise<T> {
      calls.push({ op, payload })
      const fn = script[op]
      if (!fn) throw new Error(`unexpected curator call: ${op}`)
      return fn(payload, calls.filter((c) => c.op === op).length) as T
    },
  }
  return { client, calls, count: (op: string) => calls.filter((c) => c.op === op).length }
}

const item = (composer: string, workTitle: string, conductor: string, orchestra: string): CuratedItem => ({
  composer, workTitle, conductor, orchestra, soloists: [], character: ['clear'], why: 'Because.', whyThisRecording: 'This one.', listenFor: ['the opening'],
})

const themes = (titles: [string, string, string], returning?: { at: number; themeId: string }): ThemesResponse => ({
  options: (['immersive', 'curious', 'adventurous'] as const).map((mood, i) => ({
    mood, title: titles[i], pitch: `${titles[i]} pitch`, character: ['x'], why: 'why', angle: `${titles[i]} angle`,
    returning: returning?.at === i ? { themeId: returning.themeId, note: 'We first explored this earlier.' } : undefined,
  })),
  promptVersion: 'themes@test', model: 'm',
})

const programme = (title: string, items: CuratedItem[], continuityNote?: string): ProgrammeResponse => ({
  programme: {
    title, dek: 'dek', introduction: 'intro', whyNow: 'now', historicalPlace: 'h', howTheyRelate: 'r', continuityNote,
    sections: [{ role: 'start', heading: 'Start here', items: items.slice(0, 1) }, { role: 'then', heading: 'Then', items: items.slice(1) }],
    comparisons: [{
      composer: items[0].composer, workTitle: items[0].workTitle, framing: 'f', whyBoth: 'If you want to hear …, listen to both.',
      perspectives: [
        { conductor: items[0].conductor, orchestra: items[0].orchestra, soloists: [], character: 'clear' },
        { conductor: 'Herbert von Karajan', orchestra: 'Berliner Philharmoniker', soloists: [], character: 'lush' },
      ],
    }],
  },
  removedRepeats: 0, promptVersion: 'programme@test', model: 'm',
})

const FRENCH = [item('Claude Debussy', 'La mer', 'Pierre Boulez', 'Cleveland Orchestra'), item('Maurice Ravel', 'Daphnis et Chloé', 'Pierre Monteux', 'London Symphony Orchestra'), item('Lili Boulanger', "D'un matin de printemps", 'Yan Pascal Tortelier', 'BBC Philharmonic')]
const FRENCH_AGAIN = [item('Albert Roussel', 'Bacchus et Ariane', 'Stéphane Denève', 'Royal Scottish National Orchestra'), item('Henri Dutilleux', 'Métaboles', 'George Szell', 'Cleveland Orchestra'), item('Claude Debussy', 'Jeux', 'Pierre Boulez', 'Cleveland Orchestra')]

let clock: Date
let repo: Repo
const at = (iso: string) => { clock = new Date(iso) }
const journey = (client: CuratorClient) => new Journey(repo, client, { now: () => clock })

beforeEach(() => {
  repo = new Repo(memoryStore())
  at('2026-10-08T09:00:00Z') // Thursday, week 41
})

describe('a week', () => {
  it('offers three different directions once, and keeps them', async () => {
    const c = fakeCurator({ themes: () => themes(['Into the night', 'How Debussy changed the orchestra', 'After the war']) })
    const j = journey(c.client)
    const w = await j.ensureWeek()
    expect(w.weekKey).toBe('2026-W41')
    const options = await repo.options.many(w.optionIds)
    expect(options.map((o) => o.mood)).toEqual(['immersive', 'curious', 'adventurous'])
    expect(options.every((o) => o.status === 'offered')).toBe(true)

    // Opening the app again — even twice at once — never asks again.
    await Promise.all([j.ensureWeek(), journey(c.client).ensureWeek()])
    at('2026-10-11T20:59:00Z') // Sunday 23:59 in Bucharest
    await j.ensureWeek()
    expect(c.count('themes')).toBe(1)
  })

  it('choosing one makes a programme and keeps the other two open — not rejected', async () => {
    const c = fakeCurator({ themes: () => themes(['Colour', 'Night', 'After the war']), programme: () => programme('The orchestra becomes colour', FRENCH) })
    const j = journey(c.client)
    const w = await j.ensureWeek()
    const p = await j.choose(w.optionIds[0])
    const options = await repo.options.many(w.optionIds)
    expect(options.map((o) => o.status)).toEqual(['chosen', 'open', 'open'])
    expect((await repo.weeks.require('2026-W41')).programmeId).toBe(p.id)
    expect(p.sections.flatMap((s) => s.items)).toHaveLength(3)
    expect(p.comparisonIds).toHaveLength(1)
  })

  it('leaves the week untouched when the curator fails mid-choice', async () => {
    const c = fakeCurator({ themes: () => themes(['A', 'B', 'C']), programme: () => { throw new CuratorUnavailable('busy', 'busy') } })
    const j = journey(c.client)
    const w = await j.ensureWeek()
    await expect(j.choose(w.optionIds[0])).rejects.toThrow()
    expect((await repo.weeks.require('2026-W41')).programmeId).toBeUndefined()
    expect(await repo.programmes.all()).toEqual([])
    expect((await repo.options.many(w.optionIds)).every((o) => o.status === 'offered')).toBe(true)
  })
})

describe('works and recordings', () => {
  it('keeps two interpretations of one work as two recordings of one work', async () => {
    const c = fakeCurator({ themes: () => themes(['A', 'B', 'C']), programme: () => programme('Colour', FRENCH) })
    const j = journey(c.client)
    await j.choose((await j.ensureWeek()).optionIds[0])
    const works = await repo.works.all()
    const laMer = works.find((w) => w.title === 'La mer')!
    const recs = (await repo.recordings.all()).filter((r) => r.workId === laMer.id)
    expect(recs).toHaveLength(2) // Boulez/Cleveland in the programme, Karajan/Berlin in the comparison
    expect(new Set(recs.map((r) => r.conductorId))).toEqual(new Set(['conductor:pierre-boulez', 'conductor:herbert-von-karajan']))
    expect(recs.every((r) => r.verification === 'unchecked')).toBe(true)
    const composers = (await repo.artists.all()).filter((a) => a.kind === 'composer').map((a) => a.name)
    expect(composers).toContain('Lili Boulanger')
  })
})

describe('listening and feedback', () => {
  it('records events and feedback against the specific recording', async () => {
    const c = fakeCurator({ themes: () => themes(['A', 'B', 'C']), programme: () => programme('Colour', FRENCH) })
    const j = journey(c.client)
    const p = await j.choose((await j.ensureWeek()).optionIds[0])
    const first = p.sections[0].items[0]
    await j.markListening(first, 'opened', p.id, 'app')
    await j.markListening(first, 'heard', p.id)
    const fb = await j.giveFeedback({ target: { type: 'recording', id: first.recordingId }, programmeId: p.id, reaction: 'loved', more: 'yes', note: '  The colour!  ' })
    expect(fb.note).toBe('The colour!')
    const stored = await repo.feedback.require(fb.id)
    expect(stored.target).toEqual({ type: 'recording', id: first.recordingId })
    expect((await repo.events.all()).map((e) => e.kind)).toEqual(['opened', 'heard'])
  })
})

describe('the long view', () => {
  async function aFrenchWeek(c: ReturnType<typeof fakeCurator>) {
    const j = journey(c.client)
    const w = await j.ensureWeek()
    const p = await j.choose(w.optionIds[0])
    const [debussy, ravel] = p.sections.flatMap((s) => s.items)
    await j.markListening(debussy, 'heard', p.id)
    await j.giveFeedback({ target: { type: 'recording', id: debussy.recordingId }, reaction: 'loved', note: 'I loved the orchestral colour but found the middle section too repetitive.' })
    await j.markListening(ravel, 'skipped', p.id)
    return { j, p }
  }

  it('rolls over: closes the thread, reads feedback, then offers new directions that know both', async () => {
    let themeIdSeen: string | undefined
    const c = fakeCurator({
      themes: (payload, n) => {
        if (n === 1) return themes(['French orchestral colour', 'Night', 'After the war'])
        themeIdSeen = payload.context.threads[0]?.themeId
        return themes(['Colour, by another door', 'Beethoven late', 'Spectral'], { at: 0, themeId: themeIdSeen! })
      },
      programme: (_p, n) => (n === 1 ? programme('Colour', FRENCH) : programme('Colour, again', FRENCH_AGAIN, 'We first explored this six weeks ago.')),
      continuity: () => ({ reaction: 'Strong response to La mer; Daphnis skipped.', openQuestions: ['Where does colour go after Debussy?'], adjacentTopics: ['Spectralism'], nextDirections: ['Roussel and Dutilleux'], closingNote: 'You found the sea.', promptVersion: 'c' }),
      taste: (payload) => ({
        observations: [{ facet: 'orchestral-sound', subject: 'colour', statement: 'Drawn to orchestral colour, less to repetition.', stance: 'drawn-to', confidence: 'tentative', evidence: [payload.feedback[0].id] }],
        questions: [], promptVersion: 't',
      }),
    })
    const { p } = await aFrenchWeek(c)

    // Six weeks later.
    at('2026-11-19T09:00:00Z')
    const j = journey(c.client)
    const w2 = await j.ensureWeek()
    expect(w2.weekKey).toBe('2026-W47')
    expect(c.calls.map((x) => x.op)).toEqual(['themes', 'programme', 'continuity', 'taste', 'themes'])

    // The previous week is preserved exactly.
    expect(await repo.weeks.get('2026-W41')).toBeTruthy()
    expect(await repo.programmes.require(p.id)).toEqual(p)

    // The new options were generated knowing the thread, the reaction and the taste.
    const ctx = c.calls[4].payload.context
    expect(ctx.threads[0]).toMatchObject({ title: 'French orchestral colour', since: 'six weeks ago', reaction: 'Strong response to La mer; Daphnis skipped.', nextDirections: ['Roussel and Dutilleux'] })
    expect(ctx.threads[0].response.drawnTo[0]).toContain('La mer')
    expect(ctx.threads[0].response.skipped[0]).toContain('Daphnis')
    expect(ctx.taste[0].statement).toBe('Drawn to orchestral colour, less to repetition.')
    expect(ctx.openPaths.map((o: any) => o.title)).toEqual(['Night', 'After the war'])
    expect((await repo.feedback.all())[0].interpretedAt).toBeTruthy()
  })

  it('a returning theme continues the thread: same theme, next stage, covered works sent', async () => {
    let returnTo = ''
    const c = fakeCurator({
      themes: (payload, n) => {
        if (n === 1) return themes(['French orchestral colour', 'Night', 'After the war'])
        returnTo = payload.context.threads[0].themeId
        return themes(['Colour, by another door', 'Beethoven late', 'Spectral'], { at: 0, themeId: returnTo })
      },
      programme: (_p, n) => (n === 1 ? programme('Colour', FRENCH) : programme('Colour, again', FRENCH_AGAIN, 'We first explored this six weeks ago.')),
      continuity: () => ({ reaction: 'r', openQuestions: [], adjacentTopics: [], nextDirections: ['n'], closingNote: 'c', promptVersion: 'c' }),
      taste: () => ({ observations: [], questions: [], promptVersion: 't' }),
    })
    const { p: first } = await aFrenchWeek(c)
    at('2026-11-19T09:00:00Z')
    const j = journey(c.client)
    const w2 = await j.ensureWeek()
    const second = await j.choose(w2.optionIds[0])

    const req = c.calls.filter((x) => x.op === 'programme')[1].payload
    expect(req.thread.stage).toBe(2)
    expect(req.thread.covered.works.map((w: any) => w.title)).toEqual(['La mer', 'Daphnis et Chloé', "D'un matin de printemps"])
    expect(req.option.continuityNote).toBe('We first explored this earlier.')

    expect(second.themeId).toBe(first.themeId)
    expect(second.stage).toBe(2)
    const theme = await repo.themes.require(first.themeId)
    expect(theme.explorationIds).toHaveLength(2)
    expect(await repo.themes.all()).toHaveLength(1) // one thread, not a new one

    // The Debussy work is one Work across both months: Jeux is new, La mer is not duplicated.
    const debussyWorks = (await repo.works.all()).filter((w) => w.composerId === 'composer:claude-debussy').map((w) => w.title).sort()
    expect(debussyWorks).toEqual(['Jeux', 'La mer'])
  })

  it('changing direction keeps the first programme exactly as it was', async () => {
    const c = fakeCurator({ themes: () => themes(['A', 'B', 'C']), programme: (_p, n) => programme(n === 1 ? 'First' : 'Second', n === 1 ? FRENCH : FRENCH_AGAIN) })
    const j = journey(c.client)
    const w = await j.ensureWeek()
    const first = await j.choose(w.optionIds[0])
    await expect(j.choose(w.optionIds[1])).rejects.toThrow(/change direction/)
    const second = await j.changeDirection(w.optionIds[1])

    const week = await repo.weeks.require('2026-W41')
    expect(week.programmeId).toBe(second.id)
    expect(week.setAsideProgrammeIds).toEqual([first.id])
    expect(await repo.programmes.require(first.id)).toEqual(first)
    expect((await repo.explorations.require(first.explorationId)).setAside).toBe(true)
    expect((await repo.options.many(w.optionIds)).map((o) => o.status)).toEqual(['set-aside', 'chosen', 'open'])
    await expect(repo.addProgramme(first)).rejects.toThrow(/immutable/)
  })

  it('an open path from an earlier week can be taken later', async () => {
    const c = fakeCurator({ themes: (_p, n) => themes(n === 1 ? ['A', 'Night music', 'C'] : ['D', 'E', 'F']), programme: () => programme('P', FRENCH) })
    const j = journey(c.client)
    const w1 = await j.ensureWeek()
    await j.choose(w1.optionIds[0])
    at('2026-10-15T09:00:00Z')
    const j2 = journey(c.client)
    await j2.ensureWeek()
    await j2.takeOpenPath(w1.optionIds[1])
    const taken = await repo.options.require(w1.optionIds[1])
    expect(taken).toMatchObject({ status: 'taken-later', takenInWeek: '2026-W42' })
    expect((await repo.weeks.require('2026-W42')).chosenOptionId).toBe(taken.id)
  })
})

describe('on-request extras are cached', () => {
  it('asks for resources and explanations once', async () => {
    const c = fakeCurator({
      themes: () => themes(['A', 'B', 'C']),
      programme: () => programme('Colour', FRENCH),
      resources: () => ({ resources: [{ kind: 'read', title: 'Note', url: 'https://example.org/a', source: 'Org', purpose: 'p' }], dropped: 0, promptVersion: 'r' }),
      explain: () => ({ heading: 'H', body: 'B', promptVersion: 'e' }),
    })
    const j = journey(c.client)
    const p = await j.choose((await j.ensureWeek()).optionIds[0])
    await j.resources(p.id)
    expect(await j.resources(p.id)).toHaveLength(1)
    const itemId = p.sections[0].items[0].id
    await j.explain(p.id, itemId)
    await j.explain(p.id, itemId)
    expect(c.count('resources')).toBe(1)
    expect(c.count('explain')).toBe(1)
  })

  it('remembers an empty resource search too', async () => {
    const c = fakeCurator({ themes: () => themes(['A', 'B', 'C']), programme: () => programme('Colour', FRENCH), resources: () => ({ resources: [], dropped: 2, promptVersion: 'r' }) })
    const j = journey(c.client)
    const p = await j.choose((await j.ensureWeek()).optionIds[0])
    await j.resources(p.id)
    await j.resources(p.id)
    expect(c.count('resources')).toBe(1)
  })

  it('a second perspective sits beside the programme’s recording', async () => {
    const c = fakeCurator({
      themes: () => themes(['A', 'B', 'C']),
      programme: () => programme('Colour', FRENCH),
      compare: (payload) => {
        expect(payload.alreadyHeard.map((x: any) => x.conductor)).toEqual(['Herbert von Karajan'])
        return { framing: 'f', whyBoth: 'w', current: { character: 'lucid' }, other: { conductor: 'Ernest Ansermet', orchestra: "Orchestre de la Suisse Romande", soloists: [], character: 'pointed' }, promptVersion: 'x' }
      },
    })
    const j = journey(c.client)
    const p = await j.choose((await j.ensureWeek()).optionIds[0])
    const cmp = await j.compare(p.id, p.sections[0].items[0].id)
    expect(cmp.perspectives.map((x) => x.proposed.conductor)).toEqual(['Pierre Boulez', 'Ernest Ansermet'])
    await j.compare(p.id, p.sections[0].items[0].id)
    expect(c.count('compare')).toBe(1)
  })
})

describe('the curator context', () => {
  it('is bounded and contains no numbers dressed as taste', async () => {
    const ctx = await buildContext(repo, weekOf(clock))
    expect(ctx).toMatchObject({ threads: [], openPaths: [], recentWeeks: [], recentListening: [], taste: [] })
  })
})
