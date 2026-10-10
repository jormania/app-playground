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
})

describe('asking the curator, and seeing that it is asked', () => {
  it('"Three directions with this in mind" stays, saying it is asking, until they come', async () => {
    const repo = new Repo(memoryStore())
    const c = gatedCurator('themes', 2)
    render(<App repo={repo} curator={c.client} />)
    await screen.findByText('Three ways into the week', {}, { timeout: 4000 })
    const group = screen.getByRole('group', { name: 'This week, differently' })
    await userEvent.click(group.querySelector('button')!)
    await userEvent.click(screen.getByRole('button', { name: 'Three directions with this in mind' }))
    expect(await screen.findByRole('button', { name: 'Asking…' })).toBeTruthy()
    c.open()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Asking…' })).toBeNull(), { timeout: 4000 })
    expect(screen.queryByRole('button', { name: 'Three directions with this in mind' })).toBeNull()
  }, 15000)

  it('Where next holds its other requests while one is with the curator', async () => {
    const repo = new Repo(memoryStore())
    const c = gatedCurator('themes', 2)
    const p = await chosenWeek(repo, c.client)
    window.location.hash = `#/p/${p.id}`
    render(<App repo={repo} curator={c.client} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Ask for three new directions' }, { timeout: 4000 }))
    await screen.findByRole('button', { name: 'Finding three…' })
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
