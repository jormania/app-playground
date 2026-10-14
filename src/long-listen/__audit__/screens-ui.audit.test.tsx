// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, it, expect } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { Repo, memoryStore } from '../store/repo'
import { Journey } from '../curation/journey'
import { demoCurator } from '../dev/demoCurator'
import type { CuratorClient } from '../curation/api'
import { deferred } from './journey-audit-helpers'

// The screens as the Playwright audit met them, on the demo curator's canned answers and a memory store.
beforeEach(() => {
  localStorage.clear()
  // A key, so the curator's buttons (a sitting, three others) are offered; the curator itself is the demo's.
  localStorage.setItem('long-listen:settings', JSON.stringify({ anthropicKey: 'sk-ant-api03-test' }))
  window.location.hash = '#/'
  delete document.documentElement.dataset.listening
})
afterEach(cleanup)

/** The demo curator, with a gate that holds the n-th call of an op until opened. */
function gatedCurator(op: string, nth: number) {
  const demo = demoCurator()
  const gate = deferred()
  let n = 0
  const client: CuratorClient = {
    async call(o, payload) {
      if (o === op && ++n === nth) await gate.promise
      return demo.call(o, payload)
    },
  }
  return { client, open: () => gate.resolve() }
}
const plain = (): CuratorClient => { const demo = demoCurator(); return { call: (op, payload) => demo.call(op, payload) } }

/** A week with its programme chosen, made before the page is drawn. */
async function chosenWeek(repo: Repo, curator: CuratorClient) {
  const j = new Journey(repo, curator)
  const w = await j.ensureWeek()
  return j.choose(w.optionIds[0])
}

describe('addresses that hold nothing', () => {
  for (const [hash, back] of [['#/p/nonexistent', 'This week'], ['#/listen/x/y', 'This week'], ['#/concerts/nonexistent', 'All concerts']] as const) {
    it(`${hash} says so and points back, with no "Try again"`, async () => {
      window.location.hash = hash
      render(<App repo={new Repo(memoryStore())} curator={plain()} />)
      expect(await screen.findByText(/no such|nothing at this address/i)).toBeTruthy()
      expect(screen.getAllByRole('link', { name: back }).some((a) => a.closest('main, article, div'))).toBe(true)
      expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
      // A dead listening link is not a visit: no dusk, nothing remembered.
      expect(document.documentElement.dataset.listening).toBeUndefined()
    })
  }

  it('#/listen/<a real programme>/<no such work> says so too', async () => {
    const repo = new Repo(memoryStore())
    const p = await chosenWeek(repo, plain())
    window.location.hash = `#/listen/${p.id}/nonexistent`
    render(<App repo={repo} curator={plain()} />)
    expect(await screen.findByText(/no such work/i)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    expect(document.documentElement.dataset.listening).toBeUndefined()
  })

  it('a season still to come has no button to pay for its review', async () => {
    const repo = new Repo(memoryStore())
    await chosenWeek(repo, plain())
    window.location.hash = '#/season/99'
    render(<App repo={repo} curator={plain()} />)
    expect(await screen.findByText('This season hasn’t begun.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Ask the curator to write it/ })).toBeNull()
  })

  it('a season one week in has no button either', async () => {
    const repo = new Repo(memoryStore())
    await chosenWeek(repo, plain())
    window.location.hash = '#/season/1'
    render(<App repo={repo} curator={plain()} />)
    expect(await screen.findByText(/once two weeks of it are behind you/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Ask the curator to write it/ })).toBeNull()
  })
})

describe('marking what was heard', () => {
  it('each work closes on one folded line: its state as a word, the ways on as links', async () => {
    const repo = new Repo(memoryStore())
    const p = await chosenWeek(repo, plain())
    window.location.hash = `#/p/${p.id}`
    render(<App repo={repo} curator={plain()} />)
    await screen.findByRole('heading', { name: 'La mer' }, { timeout: 4000 })
    const region = screen.getByRole('region', { name: 'Your listening: La mer' })
    // Folded, and saying where you stand; nothing is open until there's a hearing to say something about.
    expect(region.querySelector('details')?.open).toBe(false)
    expect(region.querySelector('summary')?.textContent).toBe('Your listeningNot started')
    await userEvent.click(screen.getAllByRole('radio', { name: 'Heard' })[0])
    await waitFor(() => expect(region.querySelector('summary')?.textContent).toBe('Your listeningHeard'))
    expect(region.querySelector('details')?.open).toBe(true)
    expect(screen.getAllByRole('link', { name: 'Listen with this open' }).length).toBe(p.sections.flatMap((x) => x.items).length)
  }, 15000)

  it('without Spotify, says once for the page that recordings can’t be confirmed — not under every work', async () => {
    const repo = new Repo(memoryStore())
    const p = await chosenWeek(repo, plain())
    window.location.hash = `#/p/${p.id}`
    render(<App repo={repo} curator={plain()} />)
    await screen.findByRole('heading', { name: 'La mer' }, { timeout: 4000 })
    expect(screen.getAllByText(/to confirm the exact recording/)).toHaveLength(1)
  }, 15000)

  it('re-tapping the state a work is already in records nothing', async () => {
    const repo = new Repo(memoryStore())
    const p = await chosenWeek(repo, plain())
    window.location.hash = `#/p/${p.id}`
    render(<App repo={repo} curator={plain()} />)
    await screen.findByRole('heading', { name: 'La mer' }, { timeout: 4000 })
    await userEvent.click(screen.getAllByRole('radio', { name: 'Heard' })[0])
    await waitFor(() => expect(screen.getAllByRole('radio', { name: 'Heard' })[0].getAttribute('aria-checked')).toBe('true'))
    await userEvent.click(screen.getAllByRole('radio', { name: 'Heard' })[0])
    await userEvent.click(screen.getAllByRole('radio', { name: 'Not started' })[1]) // already not started
    expect((await repo.events.all()).map((e) => e.kind)).toEqual(['heard'])
  }, 15000)

  it('"I’ve heard it" tapped twice at once is kept once', async () => {
    const repo = new Repo(memoryStore())
    const p = await chosenWeek(repo, plain())
    window.location.hash = `#/listen/${p.id}/${p.sections[0].items[0].id}`
    render(<App repo={repo} curator={plain()} />)
    const button = await screen.findByRole('button', { name: 'I’ve heard it' }, { timeout: 4000 })
    fireEvent.click(button)
    fireEvent.click(button)
    await screen.findByText('Back to the programme')
    expect((await repo.events.all()).filter((e) => e.kind === 'heard')).toHaveLength(1)
  }, 15000)

  it('a work already heard opens on how it landed, never on "I’ve heard it" again', async () => {
    const repo = new Repo(memoryStore())
    const p = await chosenWeek(repo, plain())
    const item = p.sections[0].items[0]
    window.location.hash = `#/listen/${p.id}/${item.id}`
    const first = render(<App repo={repo} curator={plain()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'I’ve heard it' }, { timeout: 4000 }))
    await screen.findByText('Back to the programme')
    first.unmount()

    // Coming back to it later: no button to mark it heard a second time.
    render(<App repo={repo} curator={plain()} />)
    await screen.findByText('Back to the programme', {}, { timeout: 4000 })
    expect(screen.queryByRole('button', { name: 'I’ve heard it' })).toBeNull()
    expect(screen.getByText('Heard')).toBeTruthy()
    expect((await repo.events.all()).filter((e) => e.kind === 'heard')).toHaveLength(1)
  }, 15000)
})

describe('asking the curator, and seeing that it is asked', () => {
  // The busy words follow one rule (UI consistency, 13 October 2026): anything
  // that makes three directions says "The curator is finding three…" — or,
  // reworking the three on offer for a change of tuning (14 October), "The
  // curator is reworking them…".
  it('"Rework these three with this in mind" stays, saying it is asking, until they come', async () => {
    const repo = new Repo(memoryStore())
    const c = gatedCurator('themes', 2)
    render(<App repo={repo} curator={c.client} />)
    await screen.findByText('Three ways into the week', {}, { timeout: 4000 })
    const group = screen.getByRole('group', { name: 'Tune this week' })
    await userEvent.click(group.querySelector('button')!)
    // The tuning moved, so the other card says the same three will be reworked, not replaced.
    expect(await screen.findByText('These three, for your new settings')).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: 'Rework these three with this in mind' }))
    expect(await screen.findByRole('button', { name: 'The curator is reworking them…' })).toBeTruthy()
    c.open()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'The curator is reworking them…' })).toBeNull(), { timeout: 4000 })
    expect(screen.queryByRole('button', { name: 'Rework these three with this in mind' })).toBeNull()
    // Made with the tuning now: nothing has moved since, so asking again means three others.
    expect(await screen.findByText('Three other directions', {}, { timeout: 4000 })).toBeTruthy()
  }, 15000)

  it('taking the tuning back to what the three were made with leaves nothing to rework', async () => {
    const repo = new Repo(memoryStore())
    const c = gatedCurator('themes', 2)
    render(<App repo={repo} curator={c.client} />)
    await screen.findByText('Three ways into the week', {}, { timeout: 4000 })
    const chip = screen.getByRole('group', { name: 'Tune this week' }).querySelector('button')!
    await userEvent.click(chip)
    await screen.findByRole('button', { name: 'Rework these three with this in mind' })
    await userEvent.click(chip)
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Rework these three with this in mind' })).toBeNull())
    expect(screen.queryByRole('button', { name: 'Three directions with this in mind' })).toBeNull()
    expect(screen.getByText('Three other directions')).toBeTruthy()
  }, 15000)

  it('Where next holds its other requests while one is with the curator', async () => {
    const repo = new Repo(memoryStore())
    const c = gatedCurator('themes', 2)
    const p = await chosenWeek(repo, c.client)
    window.location.hash = `#/p/${p.id}`
    render(<App repo={repo} curator={c.client} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Ask for three new directions' }, { timeout: 4000 }))
    await screen.findByRole('button', { name: 'The curator is finding three…' })
    for (const name of ['Ask for more', 'Make tonight’s sitting']) expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true)
    for (const b of screen.getAllByRole('button', { name: 'Listen this way instead' })) expect((b as HTMLButtonElement).disabled).toBe(true)
    c.open()
    await waitFor(() => expect((screen.getByRole('button', { name: 'Ask for more' }) as HTMLButtonElement).disabled).toBe(false), { timeout: 4000 })
  }, 15000)
})

describe('Threads', () => {
  it('lists under "Paths still open" only directions from earlier weeks', async () => {
    const repo = new Repo(memoryStore())
    const j = new Journey(repo, plain())
    await j.ensureWeek()
    await j.offerOtherDirections() // this week's first three are now open — but this week's
    window.location.hash = '#/threads'
    render(<App repo={repo} curator={plain()} />)
    await screen.findByText('What we’ve been following')
    expect(screen.queryByText('Paths still open')).toBeNull()
  })
})
