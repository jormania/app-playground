// @vitest-environment happy-dom
// Consistency audit (13 October 2026), on the screens: siblings of fixes made
// in one place (ListenMode's "I've heard it" kept once, the programme reading a
// stand-in as its item, displaySurname, MAX_ASK) and left open in others.
// Each test asserts the correct behaviour and fails today.
import { createElement } from 'react'
import { afterEach, beforeEach, describe, it, expect } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import App from '../App'
import { Repo, memoryStore } from '../store/repo'
import { Journey } from '../curation/journey'
import { demoCurator } from '../dev/demoCurator'
import type { CuratorClient } from '../curation/api'
import type { Programme } from '../domain/types'
import { aboutDuration } from '../spotify/verify'
import { addWeeks } from '../domain/season'

beforeEach(() => {
  localStorage.clear()
  // The trail, the open folds and kept searches live for the tab: one test's must not reach the next.
  sessionStorage.clear()
  localStorage.setItem('long-listen:settings', JSON.stringify({ anthropicKey: 'sk-ant-api03-test' }))
  window.location.hash = '#/'
  delete document.documentElement.dataset.listening
})
afterEach(cleanup)

const plain = (): CuratorClient => { const demo = demoCurator(); return { call: (op, payload) => demo.call(op, payload) } }
const app = (repo: Repo) => render(createElement(App, { repo, curator: plain() }))

async function chosenWeek(repo: Repo): Promise<Programme> {
  const j = new Journey(repo, plain())
  const w = await j.ensureWeek()
  return j.choose(w.optionIds[0])
}

const spotifyRef = (id: string) => ({ albumId: `a-${id}`, albumName: 'A', albumUri: 'u', artistNames: [], trackIds: [`t-${id}`], trackUris: [`spotify:track:t-${id}`], confidence: 'strong' as const, matchedAt: 'x', durationMs: 600_000 })

/** Every work confirmed on Spotify except the first, which Spotify lacks and a confirmed stand-in plays. */
async function withStandIn(repo: Repo, p: Programme) {
  const items = p.sections.flatMap((s) => s.items)
  for (const i of items.slice(1)) {
    const r = await repo.recordings.require(i.recordingId)
    await repo.recordings.put({ ...r, verification: 'verified', checkedWith: 99, spotify: spotifyRef(i.id) })
  }
  const first = items[0]
  const r = await repo.recordings.require(first.recordingId)
  await repo.recordings.put({ ...r, verification: 'not-found', checkedWith: 99 })
  await repo.recordings.put({ id: 'rec-standin', workId: first.workId, soloistIds: [], character: [], verification: 'verified', checkedWith: 99, spotify: spotifyRef('standin') })
  await repo.comparisons.put({
    id: `cmp:${p.id}:${first.id}`, workId: first.workId, framing: '', whyBoth: '', origin: 'on-request', standIn: true, createdAt: 'x',
    perspectives: [
      { recordingId: first.recordingId, proposed: first.proposed, character: '' },
      { recordingId: 'rec-standin', proposed: { ...first.proposed, conductor: 'Simon Rattle', orchestra: 'Berliner Philharmoniker' }, character: '' },
    ],
  })
  return { items, first }
}

describe('double taps record once — everywhere a tap writes, not only "I’ve heard it"', () => {
  it('the programme’s "Heard" tapped twice at once records one hearing (Programme.tsx mark)', async () => {
    const repo = new Repo(memoryStore())
    const p = await chosenWeek(repo)
    window.location.hash = `#/p/${p.id}`
    app(repo)
    await screen.findByRole('heading', { name: 'La mer' }, { timeout: 4000 })
    const heard = screen.getAllByRole('radio', { name: 'Heard' })[0]
    fireEvent.click(heard)
    fireEvent.click(heard)
    await waitFor(() => expect(screen.getAllByRole('radio', { name: 'Heard' })[0].getAttribute('aria-checked')).toBe('true'))
    expect((await repo.events.all()).filter((e) => e.kind === 'heard')).toHaveLength(1)
  }, 15000)

})

describe('a stand-in is the item — on the screens that still count only the curator’s recording', () => {
  it('the programme’s length counts the stand-in that plays (Programme.tsx RunningOrder, and the closing line)', async () => {
    const repo = new Repo(memoryStore())
    const p = await chosenWeek(repo)
    const { items } = await withStandIn(repo, p)
    window.location.hash = `#/p/${p.id}`
    app(repo)
    await screen.findByRole('heading', { name: 'La mer' }, { timeout: 4000 })
    // Said once at the head of the running order (the tools line keeps it only when there is none), and again closing the music.
    const total = aboutDuration(items.length * 600_000)
    expect(await screen.findByText(`The music · ${items.length} works · ${total}`)).toBeTruthy()
    expect(screen.getByText(`That’s the week: ${items.length} works, ${total}.`)).toBeTruthy()
  }, 15000)

  it('a thread with a work heard through a stand-in does not read "none heard yet" (domain/threadContents.ts)', async () => {
    const repo = new Repo(memoryStore())
    const p = await chosenWeek(repo)
    const { first } = await withStandIn(repo, p)
    await new Journey(repo, plain()).markListening({ recordingId: 'rec-standin', workId: first.workId }, 'heard', p.id)
    window.location.hash = '#/threads'
    app(repo)
    await screen.findByText('What we’ve been following')
    await screen.findByRole('list', { name: 'What this thread holds' })
    expect(screen.queryByText('none heard yet')).toBeNull()
  }, 15000)
})

describe('surnames as written: "Johann Strauss II" is Strauss, not "II"', () => {
  it('in the Journal’s concerts (Journal.tsx)', async () => {
    const repo = new Repo(memoryStore())
    await new Journey(repo, plain()).saveConcert({ venue: 'Ateneul Român', date: '2026-10-09', soloists: [], works: [{ composer: 'Johann Strauss II', title: 'Kaiser-Walzer' }], source: 'typed' })
    window.location.hash = '#/journal'
    app(repo)
    const em = await screen.findByText('Kaiser-Walzer', { selector: 'em' })
    expect(em.closest('li')!.textContent).toMatch(/^Strauss, /)
  }, 15000)

  it('in the season’s "Worth hearing again" (Season.tsx)', async () => {
    const repo = new Repo(memoryStore())
    await chosenWeek(repo)
    const j = new Journey(repo, plain())
    // The week moved back a season and a week, so season one is over and can have its review.
    const w = await repo.weeks.require(j.currentWeek().key)
    await repo.weeks.delete(w.weekKey)
    await repo.weeks.put({ ...w, weekKey: addWeeks(w.weekKey, -13) })
    await repo.marks.put({ id: 'season:1', at: 'x', value: { title: 'In review', opening: 'o', threads: [], taste: '', open: '', again: [{ composer: 'Johann Strauss II', work: 'Kaiser-Walzer', why: 'w' }], closing: '', promptVersion: 'v' } })
    window.location.hash = '#/season/1'
    app(repo)
    // The surname opens the composer's page under the name as written.
    const link = await screen.findByRole('link', { name: 'Strauss' })
    expect(link.getAttribute('href')).toBe('#/composer/Johann%20Strauss%20II')
    expect(link.closest('strong')!.textContent).toBe('Strauss, Kaiser-Walzer')
  }, 15000)
})

describe('MAX_ASK on every text the curator is sent, not only the wishes and questions', () => {
  it('the note to the curator (Notebook.tsx) is capped', async () => {
    const repo = new Repo(memoryStore())
    window.location.hash = '#/notebook'
    app(repo)
    const notes = await screen.findByLabelText('Note to the curator') as HTMLTextAreaElement
    expect(notes.maxLength).toBeGreaterThan(0)
  }, 15000)

  it('"How was it?" on a concert (Concerts.tsx) is capped', async () => {
    const repo = new Repo(memoryStore())
    window.location.hash = '#/concerts/new'
    app(repo)
    const note = await screen.findByLabelText('How was it?') as HTMLTextAreaElement
    expect(note.maxLength).toBeGreaterThan(0)
  }, 15000)

  it('"What stayed with you?" (FeedbackPanel.tsx) is capped', async () => {
    const repo = new Repo(memoryStore())
    const p = await chosenWeek(repo)
    await new Journey(repo, plain()).markListening(p.sections[0].items[0], 'heard', p.id)
    window.location.hash = `#/p/${p.id}`
    app(repo)
    const panel = await screen.findByRole('region', { name: 'Your listening: La mer' }, { timeout: 4000 })
    const note = within(panel).getByLabelText('What stayed with you?') as HTMLTextAreaElement
    expect(note.maxLength).toBeGreaterThan(0)
  }, 15000)
})
