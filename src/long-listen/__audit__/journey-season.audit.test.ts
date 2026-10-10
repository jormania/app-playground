import { describe, it, expect, beforeEach } from 'vitest'
import { Journey } from '../curation/journey'
import { Repo, memoryStore } from '../store/repo'
import type { CuratorClient } from '../curation/api'
import { seasonContext } from '../curation/season'
import { season } from '../domain/season'
import { fakeCurator, themes, programme, FRENCH, MORE, OTHER } from './journey-audit-helpers'

let clock: Date
let repo: Repo
const at = (iso: string) => { clock = new Date(iso) }
const journey = (client: CuratorClient) => new Journey(repo, client, { now: () => clock })

beforeEach(() => {
  repo = new Repo(memoryStore())
  at('2026-10-08T09:00:00Z') // Thursday, 2026-W41
})

describe('the season in review, after a change of direction', () => {
  it('does not tell the curator that "more of" a set-aside programme was still part of the week', async () => {
    const c = fakeCurator({
      themes: () => themes(['Colour', 'Nordic', 'C']),
      programme: (p, n) => (n === 1 ? programme('Colour', FRENCH) : p.extension ? programme('More colour', MORE) : programme('Nordic', OTHER)),
    })
    const j = journey(c.client)
    const w = await j.ensureWeek()
    const first = await j.choose(w.optionIds[0])
    await j.extendProgramme(first.id)
    await j.changeDirection(w.optionIds[1])
    const ctx = await seasonContext(repo, season('2026-W41', 1, '2026-W42'), '2026-W42')
    expect(ctx.weeks[0].programme).toBe('Nordic')
    expect(ctx.weeks[0].alsoThisWeek).toEqual([])
    expect(ctx.weeks[0].setAside).toEqual(expect.arrayContaining(['Colour', 'More colour']))
  })
})
