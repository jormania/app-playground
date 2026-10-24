// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
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
    expect(block.textContent).toMatch(/a sitting beside this week’s theme, about an hour — “minimalist music tonight”/)
    // Each says when it was made, in the listener's zone.
    expect(block.textContent).toMatch(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) · a sitting beside this week’s theme/)
    // On the sitting's own page it isn't listed against itself.
    cleanup()
    window.location.hash = `#/p/${sitting.id}`
    render(<App repo={repo} curator={plain()} />)
    await screen.findByRole('heading', { name: sitting.title }, { timeout: 4000 })
    expect(screen.queryByRole('navigation', { name: 'Also this week' })).toBeNull()
  }, 15000)
})

describe('several sittings in one week', () => {
  it('are listed in the order they were made, each with its day, and the page of one says the day it was made', async () => {
    const repo = new Repo(memoryStore())
    const p = await chosenWeek(repo, plain())
    const j = new Journey(repo, plain())
    const first = await j.sitting('first evening', 1)
    const second = await j.sitting('second evening', 2, true)
    // The second is made later, whatever the clock resolution.
    await repo.programmes.put({ ...second, createdAt: new Date(Date.parse(first.createdAt) + 60_000).toISOString() })
    window.location.hash = `#/p/${p.id}`
    render(<App repo={repo} curator={plain()} />)
    const block = await screen.findByRole('navigation', { name: 'Also this week' }, { timeout: 4000 })
    const rows = [...block.querySelectorAll('li')].map((li) => li.textContent ?? '')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toContain('first evening')
    expect(rows[1]).toContain('second evening')
    cleanup()
    window.location.hash = `#/p/${first.id}`
    render(<App repo={repo} curator={plain()} />)
    await screen.findByRole('heading', { name: first.title }, { timeout: 4000 })
    expect(document.body.textContent).toMatch(/A sitting beside this week’s theme · about an hour · (Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/)
  }, 20000)
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
    await screen.findByText('Three directions for the week', {}, { timeout: 4000 })
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
    await screen.findByText('Three directions for the week', {}, { timeout: 4000 })
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
    for (const b of screen.getAllByRole('button', { name: 'Take this direction instead' })) expect((b as HTMLButtonElement).disabled).toBe(true)
    c.open()
    await waitFor(() => expect((screen.getByRole('button', { name: 'Ask for more' }) as HTMLButtonElement).disabled).toBe(false), { timeout: 4000 })
  }, 15000)
})

// Paths left open are listed on This week (and in Where next), not on Threads.
describe('This week', () => {
  it('offers as "Left open from earlier weeks" only directions from earlier weeks', async () => {
    const repo = new Repo(memoryStore())
    const j = new Journey(repo, plain())
    await j.ensureWeek()
    await j.offerOtherDirections() // this week's first three are now open — but this week's
    render(<App repo={repo} curator={plain()} />)
    await screen.findByText('Three directions for the week', {}, { timeout: 4000 })
    expect(screen.queryByText('Left open from earlier weeks')).toBeNull()
  }, 15000)
})

describe('a reaction picked and not yet kept (batch one, 23 October 2026)', () => {
  it('is still picked when the app is opened again, waiting open rather than behind "Add a thought"', async () => {
    const repo = new Repo(memoryStore())
    const p = await chosenWeek(repo, plain())
    window.location.hash = `#/p/${p.id}`
    const first = render(<App repo={repo} curator={plain()} />)
    const heard = (await screen.findAllByRole('radio', { name: 'Heard' }, { timeout: 4000 }))[0]
    fireEvent.click(heard)
    const loved = (await screen.findAllByRole('radio', { name: 'Loved it' }, { timeout: 4000 }))[0]
    fireEvent.click(loved)
    await waitFor(() => expect(loved.getAttribute('aria-checked')).toBe('true'))
    first.unmount()

    render(<App repo={repo} curator={plain()} />)
    const again = (await screen.findAllByRole('radio', { name: 'Loved it' }, { timeout: 4000 }))[0]
    expect(again.getAttribute('aria-checked')).toBe('true')
  }, 20000)
})

describe('batch two: memory you can act on (23 October 2026)', () => {
  it('an observation can be called not quite right — kept as feedback on it, and said on the page', async () => {
    const repo = new Repo(memoryStore())
    await repo.saveTaste({
      observations: [{ id: 'obs-1', facet: 'other', subject: 'Sibelius', statement: 'Drawn to Sibelius above all.', stance: 'drawn-to', confidence: 'emerging', evidence: [], firstSeen: '2026-10-01T10:00:00Z', lastSeen: '2026-10-01T10:00:00Z' }],
      questions: [], notesToCurator: '', updatedAt: '2026-10-01T10:00:00Z',
    })
    // No key: the correction is kept and read later, not sent now.
    localStorage.removeItem('long-listen:settings')
    window.location.hash = '#/notebook'
    render(<App repo={repo} curator={plain()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Not quite' }, { timeout: 4000 }))
    fireEvent.change(screen.getByLabelText('What would be closer?'), { target: { value: 'Only the late symphonies.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tell the curator' }))
    await screen.findByText('You said this isn’t quite right; the curator will reconsider it.', {}, { timeout: 4000 })
    const said = (await repo.feedback.all()).find((f) => f.target.type === 'observation')
    expect(said).toMatchObject({ target: { type: 'observation', id: 'obs-1' }, note: 'Only the late symphonies.' })
  }, 15000)

  it('a thread offers "Return to this thread", names its composers and keeps no tally', async () => {
    const repo = new Repo(memoryStore())
    await chosenWeek(repo, plain())
    window.location.hash = '#/threads'
    render(<App repo={repo} curator={plain()} />)
    await screen.findByRole('button', { name: 'Return to this thread' }, { timeout: 4000 })
    const facts = await screen.findByRole('list', { name: 'What this thread holds' })
    expect(facts.textContent).not.toMatch(/\d+ works? by \d+ composers?|\d+ heard so far/)
    expect(facts.textContent).toMatch(/not started|started|all heard/)
  }, 15000)

  it('a performer’s name opens their page: what you’ve heard them in (batch three)', async () => {
    const repo = new Repo(memoryStore())
    const p = await chosenWeek(repo, plain())
    window.location.hash = `#/p/${p.id}`
    render(<App repo={repo} curator={plain()} />)
    let name!: HTMLElement
    await waitFor(() => {
      name = screen.getAllByRole('link').find((a) => a.className.includes('performerLink'))!
      expect(name).toBeTruthy()
    }, { timeout: 4000 })
    expect(name.getAttribute('href')).toBe(`#/performer/${encodeURIComponent(name.textContent!)}`)
    window.location.hash = name.getAttribute('href')!
    await screen.findByRole('heading', { name: name.textContent! }, { timeout: 4000 })
    expect(screen.getByRole('heading', { name: 'What you’ve heard them in' })).toBeTruthy()
    // The work it was met in is listed, its title a way back into the listening.
    expect(screen.getAllByRole('link').some((a) => a.getAttribute('href')?.startsWith(`#/listen/${p.id}/`))).toBe(true)
  }, 15000)
})

describe('batch three: finding your place, and the hall (23 October 2026)', () => {
  it('the running order marks the next work once something is heard, and leads down to Where next', async () => {
    const repo = new Repo(memoryStore())
    const p = await chosenWeek(repo, plain())
    const [first] = p.sections.flatMap((x) => x.items)
    await new Journey(repo, plain()).markListening({ recordingId: first.recordingId, workId: first.workId }, 'heard', p.id)
    window.location.hash = `#/p/${p.id}`
    render(<App repo={repo} curator={plain()} />)
    const order = await screen.findByRole('navigation', { name: 'This week’s music' }, { timeout: 4000 })
    const rows = [...order.querySelectorAll('li')]
    expect(rows[0].textContent).toContain('heard')
    expect(rows[1].textContent).toContain('next')
    expect(rows.slice(2).every((r) => !r.textContent?.includes('next'))).toBe(true)
    expect(screen.getByRole('button', { name: 'Where next ↓' })).toBeTruthy()
  }, 15000)

  it('Concerts lists what’s on in Bucharest with music already heard here', async () => {
    const repo = new Repo(memoryStore())
    const p = await chosenWeek(repo, plain())
    const [first] = p.sections.flatMap((x) => x.items)
    await new Journey(repo, plain()).markListening({ recordingId: first.recordingId, workId: first.workId }, 'heard', p.id)
    // The halls' listing as read today (live/live.ts keeps it a day): one evening with the very work.
    const surname = first.proposed.composer.split(' ').pop()!
    await repo.marks.put({ id: 'live:scan', at: new Date().toISOString(), value: [{ venue: 'Filarmonica George Enescu', title: `${surname}: ${first.proposed.work}`, date: '2099-01-15', time: '19:00', link: 'https://www.filarmonicaenescu.ro/x' }] })
    window.location.hash = '#/concerts'
    render(<App repo={repo} curator={plain()} />)
    const block = await screen.findByRole('region', { name: 'From your listening' }, { timeout: 4000 })
    expect(block.textContent).toContain(first.proposed.work)
    expect(block.textContent).toMatch(/Ateneu/)
  }, 15000)
})

describe('stabilisation: a taste profile grown long (23 October 2026)', () => {
  it('sets the surer lines first, folds first impressions beneath them, and offers to gather it', async () => {
    const repo = new Repo(memoryStore())
    const line = (i: number, confidence: 'tentative' | 'emerging' | 'settled') => ({ id: `obs-${i}`, facet: 'other' as const, subject: `s${i}`, statement: `Line ${i}.`, stance: 'drawn-to' as const, confidence, evidence: ['f'], firstSeen: '2026-10-01T10:00:00Z', lastSeen: '2026-10-01T10:00:00Z' })
    await repo.saveTaste({ observations: [line(0, 'settled'), line(1, 'emerging'), ...Array.from({ length: 28 }, (_, i) => line(i + 2, 'tentative'))], questions: [], notesToCurator: '', updatedAt: 'x' })
    window.location.hash = '#/notebook'
    render(<App repo={repo} curator={plain()} />)
    await screen.findByText('What the curator has noticed', {}, { timeout: 4000 })
    // The firmer two in the open; the twenty-eight single remarks behind one fold, without a "(a first impression)" each.
    const fold = screen.getByText('First impressions').closest('details')!
    expect(fold.open).toBe(false)
    expect(fold.textContent).toContain('Line 2.')
    expect(fold.textContent).not.toContain('a first impression')
    expect(screen.getByText(/Line 0\./).closest('details')).toBeNull()
    expect(screen.getByRole('button', { name: 'Gather it into fewer lines' })).toBeTruthy()
  }, 15000)
})

describe('evenings of their own (24 October 2026)', () => {
  it('stand in the week\'s timeline, not in its thread, and one tap puts one with the theme', async () => {
    const repo = new Repo(memoryStore())
    const p = await chosenWeek(repo, plain())
    const evening = await new Journey(repo, plain()).sitting('minimalism, nothing Nordic', 2, true)

    // The Journal: a sibling of the week's programme, with its day and mark — not "A sitting for tonight" under it.
    window.location.hash = '#/journal'
    render(<App repo={repo} curator={plain()} />)
    await screen.findByText('The weeks so far', {}, { timeout: 4000 })
    expect(document.body.textContent).toMatch(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) · an evening of its own: /)
    expect(document.body.textContent).toContain('asked for as “minimalism, nothing Nordic”')
    cleanup()

    // Threads: not among the thread's visits; gathered at the foot instead.
    window.location.hash = '#/threads'
    render(<App repo={repo} curator={plain()} />)
    await screen.findByText('What we’ve been following', {}, { timeout: 4000 })
    const visits = screen.queryByRole('list', { name: 'Visits' })
    expect(visits?.textContent ?? '').not.toContain(evening.title)
    expect(screen.getByText('Evenings of their own')).toBeTruthy()
    // Says what it does: three directions are asked for, nothing is followed yet.
    expect(screen.getByRole('button', { name: 'Ask for three directions from this evening' })).toBeTruthy()
    cleanup()

    // Its page says what it is and where it stands; one tap puts it with the theme, and the page says so.
    window.location.hash = `#/p/${evening.id}`
    render(<App repo={repo} curator={plain()} />)
    await screen.findByRole('heading', { name: evening.title }, { timeout: 4000 })
    expect(document.body.textContent).toMatch(/An evening of its own · about two hours/)
    // An evening ends with itself: no "Where next" of its own, only a way back to the week's programme and a word on how it landed.
    expect(screen.queryByRole('heading', { name: 'Where next' })).toBeNull()
    expect(screen.queryByText('More of this theme')).toBeNull()
    expect(screen.queryByText('A different direction')).toBeNull()
    expect(screen.getByRole('heading', { name: 'The end of the evening' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'The end of the evening' }).querySelector(`a[href="#/p/${p.id}"]`)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Where next ↓' })).toBeNull()
    // Its guides and notes speak of an evening, not a week.
    expect(document.body.textContent).toContain('Where the evening begins')
    expect(document.body.textContent).not.toContain('Where the week begins')
    expect(document.body.textContent).toContain('to go with this evening')
    fireEvent.click(screen.getByRole('button', { name: 'Belongs with this week’s theme' }))
    await screen.findByRole('button', { name: 'Make it an evening of its own' }, { timeout: 4000 })
    expect((await repo.explorations.require(p.explorationId)).extraProgrammeIds).toContain(evening.id)
  }, 20000)
})

describe('the week\'s end is the week\'s programme\'s business (24 October 2026)', () => {
  afterEach(() => { vi.useRealTimers() })
  it('says "The week ends tomorrow" on the week\'s programme, not on an evening of its own', async () => {
    // A Saturday in Bucharest: the week ends on Sunday. Only Date is faked, so the screens' waits still run.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-24T09:00:00Z'))
    const repo = new Repo(memoryStore())
    const p = await chosenWeek(repo, plain())
    const evening = await new Journey(repo, plain()).sitting('minimalism, nothing Nordic', 1, true)

    window.location.hash = `#/p/${p.id}`
    render(<App repo={repo} curator={plain()} />)
    const order = await screen.findByRole('navigation', { name: 'This week’s music' }, { timeout: 4000 })
    expect(order.textContent).toContain('The week ends tomorrow')
    cleanup()

    window.location.hash = `#/p/${evening.id}`
    render(<App repo={repo} curator={plain()} />)
    await screen.findByRole('heading', { name: evening.title }, { timeout: 4000 })
    expect(document.body.textContent).not.toContain('The week ends')
    // The playlist is this evening's: it comes before the week's other evenings are listed.
    const save = screen.queryByRole('button', { name: /Spotify playlist/ })
    const also = screen.queryByText(/Also this week/)
    if (save && also) expect(save.compareDocumentPosition(also) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  }, 20000)
})

describe('an evening heard to the end (24 October 2026)', () => {
  it('opens How it landed once every work is heard and nothing has been said of it', async () => {
    const repo = new Repo(memoryStore())
    await chosenWeek(repo, plain())
    const j = new Journey(repo, plain())
    const evening = await j.sitting('minimalism, nothing Nordic', 1, true)
    for (const item of evening.sections.flatMap((x) => x.items)) await j.markListening({ recordingId: item.recordingId, workId: item.workId }, 'heard', evening.id)
    window.location.hash = `#/p/${evening.id}`
    render(<App repo={repo} curator={plain()} />)
    const end = await screen.findByRole('region', { name: 'The end of the evening' }, { timeout: 4000 })
    expect(end.querySelector('details')!.open).toBe(true)
    expect(end.textContent).toContain('all heard')
  }, 20000)
})

describe('shape next week (24 October 2026)', () => {
  afterEach(() => { vi.useRealTimers() })
  it('opens once most of the week is heard, sketches with one slot left to the curator, and next week is written from it', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-22T09:00:00Z')) // Thursday, week 43
    const repo = new Repo(memoryStore())
    const p = await chosenWeek(repo, plain())
    const j = new Journey(repo, plain())
    const items = p.sections.flatMap((x) => x.items)

    // Not yet: one of three heard.
    await j.markListening({ recordingId: items[0].recordingId, workId: items[0].workId }, 'heard', p.id)
    window.location.hash = `#/p/${p.id}`
    render(<App repo={repo} curator={plain()} />)
    await screen.findByRole('heading', { name: 'Where next' }, { timeout: 4000 })
    expect(screen.queryByText('Shape next week')).toBeNull()
    expect(screen.getByText('A wish for next week')).toBeTruthy()
    cleanup()

    // Two of three: it opens, and sketching gives two sketches and the adventurous slot to the curator.
    await j.markListening({ recordingId: items[1].recordingId, workId: items[1].workId }, 'heard', p.id)
    render(<App repo={repo} curator={plain()} />)
    fireEvent.click(await screen.findByText('Shape next week', {}, { timeout: 4000 }))
    fireEvent.click(screen.getByRole('radio', { name: 'somewhere new' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sketch next week' }))
    const list = await screen.findByRole('list', { name: 'Next week’s sketches' }, { timeout: 4000 })
    await waitFor(() => expect(list.textContent).toContain('Night music, slowly'), { timeout: 4000 })
    expect(list.textContent).toContain('How a theme is built')
    expect(list.textContent).toContain('Adventurous · left to the curator')
    // Another for the curious slot: a different sketch, the first never offered again.
    fireEvent.click(screen.getAllByRole('button', { name: 'Another' })[1])
    await waitFor(() => expect(list.textContent).toContain('The orchestra as a city'), { timeout: 4000 })
    // Changing where next week goes leaves the sketches out of date: said, and one tap sketches them again.
    fireEvent.click(screen.getByRole('radio', { name: 'stay with this thread' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Sketch them again' }, { timeout: 4000 }))
    await waitFor(() => expect(document.body.textContent).not.toContain('drawn before you last changed'), { timeout: 4000 })
    // Start again asks first: the sketches cost a call each.
    fireEvent.click(screen.getByRole('button', { name: 'Start again' }))
    expect(await screen.findByText('Start next week again?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    cleanup()

    // Next Monday: the three are written from the sketches, and each says where it came from.
    vi.setSystemTime(new Date('2026-10-26T09:00:00Z'))
    window.location.hash = '#/'
    render(<App repo={repo} curator={plain()} />)
    await screen.findByRole('heading', { name: 'Three directions for the week' }, { timeout: 6000 })
    expect(screen.getByRole('heading', { name: 'Night music, slowly' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'The orchestra as a city' })).toBeTruthy()
    expect(screen.getAllByText('From your sketch')).toHaveLength(2)
    expect(screen.getByText('The curator’s own')).toBeTruthy()
    expect(document.body.textContent).toContain('shaped by you: two of three')
  }, 30000)
})
