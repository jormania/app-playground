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
  // The trail, the open folds and kept searches live for the tab: one test's must not reach the next.
  sessionStorage.clear()
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

  it('a season under way has no button either, and says when it ends — no count of weeks', async () => {
    const repo = new Repo(memoryStore())
    await chosenWeek(repo, plain())
    window.location.hash = '#/season/1'
    render(<App repo={repo} curator={plain()} />)
    expect(await screen.findByText(/^Under way — it ends on \d+ \w+ \d{4}\. Its review is written then\.$/)).toBeTruthy()
    expect(screen.queryByText(/of 12 weeks/)).toBeNull()
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
    expect(screen.getAllByRole('link', { name: 'Listen along' }).length).toBe(p.sections.flatMap((x) => x.items).length)
  }, 15000)

  it('where Spotify lacks the recording, Listen along sits straight under the stand-in’s Play, before its notes', async () => {
    const repo = new Repo(memoryStore())
    const p = await chosenWeek(repo, plain())
    const first = p.sections[0].items[0]
    const r = await repo.recordings.require(first.recordingId)
    await repo.recordings.put({ ...r, verification: 'not-found', checkedWith: 99 })
    await repo.recordings.put({ id: 'rec-standin', workId: first.workId, soloistIds: [], character: [], verification: 'verified', checkedWith: 99, spotify: { albumId: 'a', albumName: 'A', albumUri: 'u', artistNames: [], trackIds: ['t'], trackUris: ['spotify:track:t'], confidence: 'strong', matchedAt: 'x', durationMs: 600_000 } })
    await repo.comparisons.put({
      id: `cmp:${p.id}:${first.id}`, workId: first.workId, framing: 'Set side by side.', whyBoth: '', origin: 'on-request', standIn: true, createdAt: 'x',
      perspectives: [
        { recordingId: first.recordingId, proposed: first.proposed, character: '' },
        { recordingId: 'rec-standin', proposed: { ...first.proposed, conductor: 'Neeme Järvi' }, character: '', listenFor: 'The glints on the water.' },
      ],
    })
    window.location.hash = `#/p/${p.id}`
    render(<App repo={repo} curator={plain()} />)
    const notes = await screen.findByText('The glints on the water.', undefined, { timeout: 4000 })
    const work = notes.closest('[id]') as HTMLElement
    const along = [...work.querySelectorAll('a')].filter((a) => a.textContent?.includes('Listen along'))
    expect(along).toHaveLength(1)
    const framing = screen.getByText('Set side by side.')
    expect(along[0].compareDocumentPosition(framing) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(along[0].compareDocumentPosition(notes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
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

  it('"Heard" in the listening view, tapped twice at once, is kept once', async () => {
    const repo = new Repo(memoryStore())
    const p = await chosenWeek(repo, plain())
    window.location.hash = `#/listen/${p.id}/${p.sections[0].items[0].id}`
    render(<App repo={repo} curator={plain()} />)
    const button = await screen.findByRole('radio', { name: 'Heard' }, { timeout: 4000 })
    fireEvent.click(button)
    fireEvent.click(button)
    await screen.findByRole('link', { name: /^(Play next|Next):/ })
    expect((await repo.events.all()).filter((e) => e.kind === 'heard')).toHaveLength(1)
  }, 15000)

  it('a work already heard opens on "Your listening · Heard" and the way on, and a second tap on Heard records nothing', async () => {
    const repo = new Repo(memoryStore())
    const p = await chosenWeek(repo, plain())
    const item = p.sections[0].items[0]
    window.location.hash = `#/listen/${p.id}/${item.id}`
    const first = render(<App repo={repo} curator={plain()} />)
    fireEvent.click(await screen.findByRole('radio', { name: 'Heard' }, { timeout: 4000 }))
    await screen.findByRole('link', { name: /^(Play next|Next):/ })
    // The way back under "Play next" is the same link as at the top of the screen.
    const back = screen.getAllByRole('link', { name: `← ${p.title}` })
    expect(back).toHaveLength(2)
    expect(back[0].getAttribute('href')).toBe(back[1].getAttribute('href'))
    expect(screen.queryByText('Back to the programme')).toBeNull()
    first.unmount()

    // Coming back to it later: the row says Heard, and tapping Heard again is a no-op.
    render(<App repo={repo} curator={plain()} />)
    await screen.findByRole('link', { name: /^(Play next|Next):/ }, { timeout: 4000 })
    const row = screen.getByRole('region', { name: /^Your listening/ })
    expect(row.querySelector('summary')?.textContent).toBe('Your listeningHeard')
    fireEvent.click(screen.getByRole('radio', { name: 'Heard' }))
    expect((await repo.events.all()).filter((e) => e.kind === 'heard')).toHaveLength(1)
  }, 15000)
})

describe('what was made beside this week’s programme', () => {
  it('a sitting for tonight is at the top of the programme, not only in the fold at its foot', async () => {
    const repo = new Repo(memoryStore())
    const p = await chosenWeek(repo, plain())
    const sitting = await new Journey(repo, plain()).sitting('minimalist music tonight', 1)
    window.location.hash = `#/p/${p.id}`
    render(<App repo={repo} curator={plain()} />)
    const block = await screen.findByRole('navigation', { name: 'Also this week' }, { timeout: 4000 })
    const link = [...block.querySelectorAll('a')].find((a) => a.textContent === sitting.title)
    expect(link?.getAttribute('href')).toBe(`#/p/${sitting.id}`)
    expect(block.textContent).toMatch(/a sitting for tonight, about an hour — “minimalist music tonight”/)
    // On the sitting's own page it isn't listed against itself.
    cleanup()
    window.location.hash = `#/p/${sitting.id}`
    render(<App repo={repo} curator={plain()} />)
    await screen.findByRole('heading', { name: sitting.title }, { timeout: 4000 })
    expect(screen.queryByRole('navigation', { name: 'Also this week' })).toBeNull()
  }, 15000)
})

describe('a sitting asked for and not yet made', () => {
  it('keeps what was typed when the app is closed, says so on the folded line, and lets go once the evening is made', async () => {
    const repo = new Repo(memoryStore())
    const p = await chosenWeek(repo, plain())
    window.location.hash = `#/p/${p.id}`
    const first = render(<App repo={repo} curator={plain()} />)
    fireEvent.change(await screen.findByLabelText('What would you like tonight?', undefined, { timeout: 4000 }), { target: { value: 'minimalist music tonight' } })
    first.unmount()

    // The app opened again: the request is still there, and the folded line says it isn't made yet.
    render(<App repo={repo} curator={plain()} />)
    const input = await screen.findByLabelText('What would you like tonight?', undefined, { timeout: 4000 })
    expect((input as HTMLInputElement).value).toBe('minimalist music tonight')
    expect(document.body.textContent).toContain('“minimalist music tonight” — not made yet')

    // Made: the request is let go, not left to be asked again next week.
    fireEvent.click(screen.getByRole('button', { name: 'Make tonight’s sitting' }))
    await waitFor(() => expect(window.location.hash).not.toBe(`#/p/${p.id}`), { timeout: 8000 })
    expect(localStorage.getItem('long-listen:kept:sitting-request')).toBeNull()
  }, 20000)
})

describe('the rows a work closes on', () => {
  it('the listening view closes on the programme’s two rows, and opening "More context" is the asking', async () => {
    const repo = new Repo(memoryStore())
    const p = await chosenWeek(repo, plain())
    const item = p.sections[0].items[0]
    window.location.hash = `#/listen/${p.id}/${item.id}`
    render(<App repo={repo} curator={plain()} />)
    const row = await screen.findByRole('region', { name: /^Your listening/ }, { timeout: 4000 })
    expect(row.querySelector('summary')?.textContent).toBe('Your listeningNot started')
    expect(screen.queryByRole('button', { name: 'I’ve heard it' })).toBeNull()
    const context = [...document.querySelectorAll('summary')].find((x) => x.textContent?.startsWith('More context'))
    expect(context).toBeTruthy()
    const details = context!.parentElement as HTMLDetailsElement
    // A tap on its label, then the toggle the browser fires: only a tap asks the curator.
    fireEvent.click(context!)
    details.open = true
    details.dispatchEvent(new Event('toggle'))
    await waitFor(async () => expect(await repo.explanations.get(`${p.id}:${item.id}`)).toBeTruthy(), { timeout: 4000 })
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

// Paths left open are listed on This week (and in Where next), not on Threads.
describe('This week', () => {
  it('offers as "A path left open" only directions from earlier weeks', async () => {
    const repo = new Repo(memoryStore())
    const j = new Journey(repo, plain())
    await j.ensureWeek()
    await j.offerOtherDirections() // this week's first three are now open — but this week's
    render(<App repo={repo} curator={plain()} />)
    await screen.findByText('Three ways into the week', {}, { timeout: 4000 })
    expect(screen.queryByText('A path left open')).toBeNull()
  }, 15000)
})
