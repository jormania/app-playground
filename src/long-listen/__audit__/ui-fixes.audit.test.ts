import { describe, it, expect, beforeEach } from 'vitest'
import { Journey } from '../curation/journey'
import { NotFound, Repo, memoryStore } from '../store/repo'
import type { CuratorClient } from '../curation/api'
import type { Concert, ProposedRecording, Work } from '../domain/types'
import { journalWeek } from '../domain/journalWeek'
import { playingKeys, removeSoloist, toDraft, toForm, toggleSoloist } from '../domain/concertForm'
import { searchLibrary } from '../domain/librarySearch'
import { parseRoute } from '../app/router'
import { fakeCurator, themes, programme, FRENCH, EVENING, OTHER } from './journey-audit-helpers'

let clock: Date
let repo: Repo
const at = (iso: string) => { clock = new Date(iso) }
const journey = (client: CuratorClient) => new Journey(repo, client, { now: () => clock })
const optionsById = async () => new Map((await repo.options.all()).map((o) => [o.id, o]))

beforeEach(() => {
  repo = new Repo(memoryStore())
  at('2026-10-08T09:00:00Z') // Thursday, 2026-W41
})

describe('the Journal: how a week’s music was come by', () => {
  it('a sitting made on a week of three directions is "a sitting", not a fourth direction chosen from', async () => {
    const c = fakeCurator({ themes: () => themes(['A', 'B', 'C']), programme: () => programme('An evening of horns', EVENING) })
    const j = journey(c.client)
    const w = await j.ensureWeek()
    await j.sitting('quiet', 1)
    const view = journalWeek(await repo.weeks.require(w.weekKey), await optionsById())
    expect(view.choice).toEqual({ kind: 'sitting' })
    expect(view.offered).toHaveLength(3)
    expect(view.others.map((o) => o.title)).toEqual(['A', 'B', 'C'])
  })

  it('a path taken from an earlier week is said as such, and is not among the new week’s "also offered"', async () => {
    const c = fakeCurator({
      themes: () => themes(['French colour', 'Nordic', 'C']),
      programme: (_p, n) => (n === 1 ? programme('French colour', FRENCH) : programme('Nordic', OTHER)),
    })
    const j = journey(c.client)
    const w41 = await j.ensureWeek()
    await j.choose(w41.optionIds[0])
    at('2026-10-15T09:00:00Z') // W42
    await j.weekWithoutDirections()
    await j.takeOpenPath(w41.optionIds[1])

    const byId = await optionsById()
    const w42 = journalWeek(await repo.weeks.require('2026-W42'), byId)
    expect(w42.choice).toEqual({ kind: 'path', fromWeek: '2026-W41' })
    expect(w42.others).toEqual([])
    // It stays listed where it was offered, as taken later.
    const earlier = journalWeek(await repo.weeks.require('2026-W41'), byId)
    expect(earlier.choice).toEqual({ kind: 'chosen', from: 3 })
    expect(earlier.others.find((o) => o.id === w41.optionIds[1])?.status).toBe('taken-later')
  })
})

describe('the concert form: soloists keep who they are while being edited', () => {
  const draft = () => ({
    venue: 'Ateneul Român', date: '2026-10-01', source: 'typed' as const,
    soloists: [{ name: 'Alina Ibragimova', instrument: 'violin' }, { name: 'Sol Gabetta', instrument: 'cello' }],
    works: [{ composer: 'Brahms', title: 'Double Concerto', soloists: ['Alina Ibragimova', 'Sol Gabetta'] }, { composer: 'Elgar', title: 'Cello Concerto', soloists: ['Sol Gabetta'] }],
  })

  it('renaming one soloist to the other’s name does not merge them, and the works still follow the rows', () => {
    let n = 0
    let f = toForm(draft(), () => `k${++n}`)
    const [alina, sol] = f.soloists.map((x) => x.key)
    // Typing over Alina's name, passing through Sol's on the way.
    f = { ...f, soloists: f.soloists.map((x) => (x.key === alina ? { ...x, name: 'Sol Gabetta' } : x)) }
    f = { ...f, soloists: f.soloists.map((x) => (x.key === alina ? { ...x, name: 'Vilde Frang' } : x)) }
    expect(playingKeys(f, f.works[1])).toEqual([sol])
    expect(toDraft(f).works.map((w) => w.soloists)).toEqual([['Vilde Frang', 'Sol Gabetta'], ['Sol Gabetta']])
    // Two rows, two chips: their keys differ even while their names were the same.
    expect(new Set(f.soloists.map((x) => x.key)).size).toBe(2)
  })

  it('removing a soloist takes them off every work', () => {
    let f = toForm(draft())
    const sol = f.soloists[1].key
    f = removeSoloist(f, sol)
    expect(toDraft(f).works.map((w) => w.soloists)).toEqual([['Alina Ibragimova'], []])
  })

  it('a chip pressed on a judged work makes that work’s list explicit, by row', () => {
    let f = toForm({ ...draft(), works: [{ composer: 'Brahms', title: 'Symphony No. 4' }, { composer: 'Elgar', title: 'Cello Concerto' }] })
    const sol = f.soloists[1].key
    expect(playingKeys(f, f.works[1])).toEqual([sol])
    f = toggleSoloist(f, 0, sol)
    expect(toDraft(f).works.map((w) => w.soloists)).toEqual([['Sol Gabetta'], undefined])
  })
})

describe('the Library’s search', () => {
  const proposed = (p: Partial<ProposedRecording>): ProposedRecording => ({ composer: 'Antonín Dvořák', work: 'Cello Concerto', conductor: 'Václav Talich', soloists: [], ...p })
  const work = (id: string, title: string, catalogue?: string): Work => ({ id, composerId: 'c', title, ...(catalogue ? { catalogue } : {}) } as Work)
  const concert: Concert = {
    id: 'concert_1', venue: 'Ateneul Român', date: '2026-10-01', conductor: 'Gabriel Bebeșelea', orchestra: 'Filarmonica George Enescu', source: 'typed', createdAt: 'x',
    soloists: [{ name: 'Alexandra Conunova', instrument: 'violin' }],
    works: [{ workId: 'w2', composer: 'Johann Sebastian Bach', title: 'Violin Concerto in A minor', catalogue: 'BWV 1041' }],
  }
  const entries = [
    { composer: 'Antonín Dvořák', works: [{ work: work('w1', 'Cello Concerto', 'Op. 104'), recordings: [{ proposed: proposed({}) }], live: [] }] },
    { composer: 'Johann Sebastian Bach', works: [{ work: work('w2', 'Violin Concerto in A minor', 'BWV 1041'), recordings: [], live: [concert] }] },
  ]
  const found = (q: string) => searchLibrary(entries, q).flatMap((e) => e.works.map((w) => w.work.id))

  it('finds a work by its catalogue number', () => {
    expect(found('op. 104')).toEqual(['w1'])
    expect(found('bwv 1041')).toEqual(['w2'])
  })

  it('finds a work heard live by the evening’s conductor, orchestra or soloist, accents or not', () => {
    expect(found('Bebeselea')).toEqual(['w2'])
    expect(found('enescu')).toEqual(['w2'])
    expect(found('Conunova')).toEqual(['w2'])
    expect(found('talich')).toEqual(['w1'])
  })
})

describe('the season in review, asked for too soon', () => {
  it('a season not yet begun, or a single week in, is not written (nothing paid for)', async () => {
    const c = fakeCurator({ themes: () => themes(['A', 'B', 'C']) })
    const j = journey(c.client)
    await j.ensureWeek()
    expect((await j.seasonReview(99)).season.weeksSoFar).toBe(0)
    await expect(j.writeSeasonReview(99)).rejects.toThrow(/hasn’t begun/)
    await expect(j.writeSeasonReview(1)).rejects.toThrow(/two weeks/)
    expect(c.count('season')).toBe(0)
  })

  it('reads only a whole season number from the address', () => {
    expect(parseRoute('#/season/2')).toEqual({ name: 'season', n: 2 })
    for (const bad of ['#/season/1.5', '#/season/1e1', '#/season/0', '#/season/x', '#/season/']) expect(parseRoute(bad)).toEqual({ name: 'journal' })
  })
})

describe('an address that holds nothing', () => {
  it('is told apart from a failure', async () => {
    await expect(repo.programmes.require('prog_nonexistent')).rejects.toBeInstanceOf(NotFound)
    await expect(repo.concerts.require('nonexistent')).rejects.toBeInstanceOf(NotFound)
  })
})
