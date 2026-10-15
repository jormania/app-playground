// @vitest-environment happy-dom
// The Journal audit (15 October 2026): a work stays in its programme's week,
// a concert still to come isn't "heard live", and the week says no counts.
import { createElement } from 'react'
import { afterEach, beforeEach, describe, it, expect } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import App from '../App'
import { Repo, memoryStore } from '../store/repo'
import { Journey } from '../curation/journey'
import { seasonContext } from '../curation/season'
import { demoCurator } from '../dev/demoCurator'
import { displaySurname } from '../domain/identity'
import { curly } from '../domain/programmeStyle'
import { season } from '../domain/season'
import type { CuratorClient } from '../curation/api'
import type { Concert } from '../domain/types'

beforeEach(() => {
  localStorage.clear()
  // The trail, the open folds and kept searches live for the tab: one test's must not reach the next.
  sessionStorage.clear()
  localStorage.setItem('long-listen:settings', JSON.stringify({ anthropicKey: 'sk-ant-api03-test' }))
  window.location.hash = '#/journal'
})
afterEach(cleanup)

const plain = (): CuratorClient => { const demo = demoCurator(); return { call: (op, payload) => demo.call(op, payload) } }
const future: Concert = {
  id: 'c-future', venue: 'Sala Radio', date: '2099-05-01', soloists: [], source: 'typed', createdAt: 'x',
  works: [{ workId: 'w-x', composer: 'George Enescu', title: 'Romanian Rhapsody No. 1' }],
}

/** A programme chosen in week 41, its first work heard in week 42, a word on the programme and the work. */
async function seeded() {
  const repo = new Repo(memoryStore())
  let clock = new Date('2026-10-08T09:00:00Z') // W41
  const j = new Journey(repo, plain(), { now: () => clock })
  const p = await j.choose((await j.ensureWeek()).optionIds[0])
  clock = new Date('2026-10-14T09:00:00Z') // W42
  const first = p.sections.flatMap((x) => x.items)[0]
  await j.markListening(first, 'heard', p.id)
  await j.giveFeedback({ target: { type: 'recording', id: first.recordingId }, programmeId: p.id, reaction: 'loved', note: 'The sea, at last.' })
  await j.giveFeedback({ target: { type: 'programme', id: p.id }, programmeId: p.id, note: 'A week of colour.' })
  await repo.concerts.put(future)
  return { repo, p, first }
}

describe('the Journal, week by week', () => {
  it('lists a work under its programme’s week, however late it was heard, as one line', async () => {
    const { repo, p, first } = await seeded()
    render(createElement(App, { repo, curator: plain() }))
    const w41 = await screen.findByRole('region', { name: 'Week 41, 2026' }, { timeout: 4000 })
    expect(screen.queryByRole('region', { name: /^Week 42/ })).toBeNull()
    const line = within(w41).getByText(curly(first.proposed.work), { selector: 'em' }).closest('li')!
    expect(line.textContent).toMatch(new RegExp(`^${displaySurname(first.proposed.composer)}, `))
    expect(within(line).getByRole('link', { name: displaySurname(first.proposed.composer) }).getAttribute('href')).toBe(`#/composer/${encodeURIComponent(first.proposed.composer)}`)
    expect(line.textContent).toContain('Heard')
    expect(line.textContent).toContain('Loved it')
    expect(within(line).getByText('The sea, at last.')).toBeTruthy()
    // Only what was begun: the programme's other works aren't listed.
    expect(within(w41).getAllByText(/./, { selector: 'ul li em' })).toHaveLength(1)
    // The listener's word on the week's programme, under its title.
    expect(within(w41).getByRole('link', { name: p.title })).toBeTruthy()
    expect(within(w41).getByText('A week of colour.', { selector: 'q' })).toBeTruthy()
    // No count where the list says it.
    expect(within(w41).queryByText(/Chosen from/)).toBeNull()
    expect(within(w41).getByRole('heading', { name: 'Also offered' })).toBeTruthy()
  })

  it('a concert still to come is not "heard live"', async () => {
    const { repo } = await seeded()
    render(createElement(App, { repo, curator: plain() }))
    await screen.findByRole('region', { name: 'Week 41, 2026' }, { timeout: 4000 })
    expect(screen.queryByText('Sala Radio')).toBeNull()
    expect(screen.queryByText(/Heard live/)).toBeNull()
  })

  it('links no season under way', async () => {
    const { repo } = await seeded()
    render(createElement(App, { repo, curator: plain() }))
    await screen.findByRole('region', { name: 'Week 41, 2026' }, { timeout: 4000 })
    expect(screen.queryByRole('link', { name: /^Season/ })).toBeNull()
  })
})

describe('the season in review’s context', () => {
  it('does not tell the curator a concert still to come was heard', async () => {
    const repo = new Repo(memoryStore())
    await repo.concerts.put({ ...future, date: '2026-10-20' })
    await repo.concerts.put({ ...future, id: 'c-past', venue: 'Ateneul Român', date: '2026-10-10' })
    const ctx = await seasonContext(repo, season('2026-W41', 1, '2026-W42'), '2026-W42', 'Europe/Bucharest', '2026-10-15')
    expect(ctx.concerts.map((c) => c.venue)).toEqual(['Ateneul Român'])
  })
})
