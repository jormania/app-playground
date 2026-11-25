// @vitest-environment jsdom
// The whole app on an in-memory store with the demo seeded, driven the way a
// person would: the tour, the dashboard, adding a payment, tax switched off,
// the printable report, clearing the demo.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { memoryStore, type KeyValueStore } from '../shared/kvStore'
import App from './App'
import { ALL_FEATURES, SETTINGS_KEY } from './store/settings'
import { buildDemo } from './data/demo'
import type { FeatureKey, InflowData } from './domain/types'
import type { Repo } from './store/repo'
import { vi } from 'vitest'

const today = '2026-11-25'
let store: KeyValueStore

async function go(hash: string) {
  await act(async () => {
    window.location.hash = hash
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  })
}

function settings(patch: Record<string, unknown> = {}) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ showTour: false, ...patch }))
}

beforeEach(() => {
  localStorage.clear()
  store = memoryStore()
  window.location.hash = ''
  window.matchMedia = window.matchMedia ?? ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList)
})
afterEach(cleanup)

describe('InFlow', () => {
  it('shows the tour on first run, and remembers "don\'t show next time"', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App store={store} today={today} />)
    expect(await screen.findByText('Welcome to InFlow')).toBeTruthy()
    await user.click(screen.getByLabelText(/Show this guide next time/))
    await user.click(screen.getByRole('button', { name: 'Skip' }))
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!).showTour).toBe(false)
    unmount()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    expect(screen.queryByText('Welcome to InFlow')).toBeNull()
  })

  it('opens on a dashboard built from the seeded demo', async () => {
    settings()
    render(<App store={store} today={today} />)
    const total = await screen.findByTestId('period-total')
    expect(total.textContent).toMatch(/lei$/)
    expect(total.textContent).not.toBe('0 lei')
    expect(screen.getByText('Where it came from')).toBeTruthy()
    expect(screen.getByText(/Set aside for tax/)).toBeTruthy()
    expect(screen.getAllByText('Optional').length).toBeGreaterThan(0)
  })

  it('adds a payment with the tax folded away as an optional suggestion', async () => {
    settings()
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    await user.click(screen.getByRole('button', { name: /Add income/ }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Amount'), '750')
    await user.selectOptions(within(dialog).getByLabelText('Client'), within(dialog).getByRole('option', { name: 'Andreea Vlad' }))
    expect(within(dialog).getByText(/\(suggested\)/)).toBeTruthy()
    await user.click(within(dialog).getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    // The demo is its own workspace: what you add while exploring stays in it.
    const saved = (await store.get<{ records: { amount: number; clientId: string; classification: string; taxReserve: number | null }[] }>('demo'))!
    const mine = saved.records.find((r) => r.amount === 750 && r.clientId === 'demo_c_andreea')!
    expect(mine.classification).toBe('suggested')
    expect(mine.taxReserve).toBeGreaterThan(0)
  })

  it('with tax switched off shows only the money flow', async () => {
    settings({ trackTax: false })
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    expect(screen.queryByText(/Set aside for tax/)).toBeNull()
    expect(screen.getByText('Average payment')).toBeTruthy()
    await go('#/reports')
    expect(screen.queryByRole('radio', { name: 'Tax*' })).toBeNull()
  })

  it('prints one of four reports, each with its advice, and adjusts', async () => {
    settings()
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    await go('#/reports/print')
    expect(within(screen.getByRole('radiogroup', { name: 'Report' })).getAllByRole('radio')).toHaveLength(4)
    expect(screen.getByText('At the end of each month.')).toBeTruthy()
    const frame = await screen.findByTitle('Report preview') as HTMLIFrameElement
    expect(frame.getAttribute('srcdoc')).toContain('In short')
    expect(frame.getAttribute('srcdoc')).toContain('Pain points and wins')
    // A statement waits for its client.
    await user.click(screen.getByRole('radio', { name: /Client statement/ }))
    expect(screen.queryByTitle('Report preview')).toBeNull()
    await user.selectOptions(screen.getByLabelText('Client'), screen.getByRole('option', { name: 'Andreea Vlad' }))
    expect((await screen.findByTitle('Report preview')).getAttribute('srcdoc')).toContain('Andreea Vlad')
    // Adjust: a section off leaves the print.
    await user.click(screen.getByRole('radio', { name: /Year in review/ }))
    await user.click(screen.getByText('Adjust this report'))
    await user.click(screen.getByLabelText('By venue'))
    expect((screen.getByTitle('Report preview') as HTMLIFrameElement).getAttribute('srcdoc')).not.toContain('By venue')
  })

  it('the review tells the period: summary, movers, who pays; a drill-down offers the way back', async () => {
    settings()
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    await go('#/reports/insights')
    expect(await screen.findByText('November 2026 in review')).toBeTruthy()
    const summary = screen.getByLabelText('Summary')
    for (const k of ['Came in', 'Top client']) expect(within(summary).getByText(k)).toBeTruthy()
    // No paragraph to read: the facts are rows.
    expect(summary.querySelectorAll('p')).toHaveLength(0)
    const moved = within(screen.getByLabelText('Main movers')).getAllByRole('button')
    expect(moved.length).toBeGreaterThan(0)
    await user.click(moved[0])
    expect(window.location.hash).toBe('#/income')
    const back = await screen.findByRole('link', { name: '← Back to Review' })
    expect(back.getAttribute('href')).toBe('#/reports/insights')
  })

  it('keeps the demo and your own data apart, and switches between them', async () => {
    settings()
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    const demoTotal = (await screen.findByTestId('period-total')).textContent
    expect(screen.getByText(/exploring a demo practice/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Switch to my data' }))
    // Nothing recorded yet: steps in, not a dashboard of zeros.
    const start = await screen.findByLabelText('Start here')
    expect(screen.queryByTestId('period-total')).toBeNull()
    expect(screen.queryByText(/exploring a demo practice/)).toBeNull()
    await user.click(within(start).getByRole('button', { name: /Add income/ }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Amount'), '500')
    await user.click(within(dialog).getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(screen.getByTestId('period-total').textContent).toMatch(/^500/))
    expect(screen.queryByLabelText('Start here')).toBeNull()
    const mine = (await store.get<{ records: { amount: number; demo?: boolean }[] }>('data'))!
    expect(mine.records).toHaveLength(1)
    expect(mine.records[0].demo).toBeFalsy()
    // Back to the demo: untouched by the payment above.
    await go('#/settings')
    await user.click(screen.getByRole('radio', { name: 'Demo practice' }))
    await go('#/overview')
    await waitFor(() => expect(screen.getByTestId('period-total').textContent).toBe(demoTotal))
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!).openingCash).toBe(0)
  })

  it('clears the demo, offers it back, and never touches your data', async () => {
    settings({ workspace: 'demo', demoSeeded: true })
    await store.set('data', { records: [{ ...buildDemo(today).records[0], id: 'loc_mine', demo: undefined, description: 'Mine' }], costs: [], clients: [], sources: [], venues: [] })
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    await go('#/settings')
    await user.click(await screen.findByRole('button', { name: 'Clear demo data' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Clear' }))
    await waitFor(async () => expect((await store.get<{ records: unknown[] }>('demo'))!.records).toHaveLength(0))
    expect((await store.get<{ records: { id: string }[] }>('data'))!.records.map((r) => r.id)).toEqual(['loc_mine'])
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!).workspace).toBe('mine')
    await user.click(await screen.findByRole('button', { name: 'Bring it back' }))
    await waitFor(async () => expect((await store.get<{ records: unknown[] }>('demo'))!.records.length).toBeGreaterThan(100))
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!).workspace).toBe('demo')
  })

  it('splits a demo an older InFlow mixed into your data', async () => {
    settings({ demoSeeded: true })
    const demo = buildDemo(today)
    await store.set('data', { ...demo, records: [...demo.records, { ...demo.records[0], id: 'loc_mine', demo: undefined, description: 'Mine' }] })
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    const data = (await store.get<{ records: { id: string }[]; clients: { id: string }[] }>('data'))!
    expect(data.records.map((r) => r.id)).toEqual(['loc_mine'])
    // The demo client that payment points at stays, so it keeps its name.
    expect(data.clients.map((c) => c.id)).toEqual([demo.records[0].clientId])
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!).workspace).toBe('mine')
  })
})

describe('small conveniences', () => {
  it('offers a client\'s usual amounts, and writes an empty description from what is known', async () => {
    settings()
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    await user.click(screen.getByRole('button', { name: /Add income/ }))
    const dialog = await screen.findByRole('dialog')
    await user.selectOptions(within(dialog).getByLabelText('Client'), within(dialog).getByRole('option', { name: 'Radu Stoica' }))
    const chips = within(within(dialog).getByLabelText('Usual amounts')).getAllByRole('button')
    expect(chips.length).toBeGreaterThan(0)
    await user.click(chips[0])
    expect((within(dialog).getByLabelText('Amount') as HTMLInputElement).value).not.toBe('')
    await user.clear(within(dialog).getByLabelText('Description'))
    expect((within(dialog).getByLabelText('Description') as HTMLInputElement).placeholder).toContain(' · ')
  })

  it('turns the head count into an amount at a venue with a known price per head', async () => {
    settings()
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    await user.click(screen.getByRole('button', { name: /Add income/ }))
    const dialog = await screen.findByRole('dialog')
    await user.selectOptions(within(dialog).getByLabelText('Venue'), within(dialog).getByRole('option', { name: 'Casa Verde loft' }))
    await user.type(within(dialog).getByLabelText(/People who came/), '10')
    expect(within(dialog).getByText(/10 × 220 lei/)).toBeTruthy()
    await user.click(within(dialog).getByRole('button', { name: 'Use' }))
    expect((within(dialog).getByLabelText('Amount') as HTMLInputElement).value).toBe('2200')
  })

  it('copies a friendly reminder for an expected payment', async () => {
    settings()
    const user = userEvent.setup()
    // After setup: user-event installs a clipboard of its own.
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    await user.click(screen.getAllByRole('button', { name: /Copy a reminder for/ })[0])
    expect(writeText).toHaveBeenCalledTimes(1)
    const text = writeText.mock.calls[0][0] as string
    expect(text.startsWith('Hello')).toBe(true)
    expect(text).toContain('A gentle reminder about the payment for')
    expect(await screen.findByText(/Reminder copied/)).toBeTruthy()
  })

  it('opens the form from a home-screen shortcut, and N adds from the keyboard', async () => {
    settings()
    window.location.hash = '#/add/cost'
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    expect(await screen.findByRole('dialog', { name: /Add cost/ })).toBeTruthy()
    expect(window.location.hash).toBe('#/costs')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await user.keyboard('n')
    expect(await screen.findByRole('dialog', { name: /Add cost/ })).toBeTruthy()
  })

  it('keeps "Where it went" when nothing was paid in the period, with all time one tap away', async () => {
    settings()
    localStorage.setItem('inflow:period', JSON.stringify({ preset: 'custom', from: '2026-11-25', to: '2026-11-25' }))
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    await go('#/costs')
    const panel = await screen.findByLabelText('Where it went')
    expect(within(panel).getByText(/Nothing paid .* yet/)).toBeTruthy()
    await user.click(within(panel).getByRole('button', { name: 'See the whole year' }))
    expect(await within(screen.getByLabelText('Where it went')).findByText('spent')).toBeTruthy()
  })

})

describe('one period, no repeats', () => {
  it('on Week, the Overview shows the week once and no monthly target; lists follow the period with no own range', async () => {
    settings()
    localStorage.setItem('inflow:period', JSON.stringify({ preset: 'week' }))
    render(<App store={store} today={today} />)
    const hero = await screen.findByLabelText('Income this period')
    expect(within(hero).queryByText('This month')).toBeNull()
    expect(within(hero).getAllByText(/This week/)).toHaveLength(1)
    expect(within(hero).queryByLabelText('Target')).toBeNull()
    await go('#/income')
    expect(screen.queryByRole('button', { name: 'All time' })).toBeNull()
    // Expected payments stay in view whatever the period.
    expect((await screen.findAllByText('Expected')).length).toBeGreaterThan(0)
  })
})

describe('audit conveniences', () => {
  it('suggests next month from a recurring client, adds it in one tap, or lets it go', async () => {
    settings()
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    const box = await screen.findByLabelText('Suggested from recurring payments')
    await user.click(within(box).getByRole('button', { name: /Expect Ioana/ }))
    expect(await screen.findByText(/Expected on/)).toBeTruthy()
    expect(within(screen.getByLabelText('Expected payments')).queryByRole('button', { name: /Expect Ioana/ })).toBeNull()
    const next = within(screen.getByLabelText('Suggested from recurring payments')).getAllByRole('button', { name: /^Not this time/ })[0]
    const name = next.getAttribute('aria-label')!
    await user.click(next)
    expect(screen.queryByRole('button', { name })).toBeNull()
  })

  it('finds payments by amount in the search', async () => {
    settings()
    localStorage.setItem('inflow:period', JSON.stringify({ preset: 'year' }))
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    await go('#/income')
    await user.type(screen.getByLabelText('Search income'), '6.500')
    const rows = await screen.findAllByRole('button', { name: /Team-lead coaching circle/ })
    expect(rows.length).toBeGreaterThan(5)
    expect(screen.queryByRole('button', { name: /Coaching session, 400/ })).toBeNull()
  })

  it('nudges a backup when your own data on this device has none for a month', async () => {
    settings({ workspace: 'mine', demoSeeded: true })
    const own = buildDemo(today).records.filter((r) => r.status === 'received').slice(0, 6).map((r, i) => ({ ...r, id: `loc_${i}`, demo: undefined }))
    await store.set('data', { records: own, costs: [], clients: [], sources: [], venues: [] })
    localStorage.setItem('inflow:last-backup', JSON.stringify('2026-09-01'))
    // jsdom has no object URLs; a browser does.
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() })
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    expect(await screen.findByText(/Last backup 85 days ago/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Download backup' }))
    await waitFor(() => expect(screen.queryByText(/Last backup/)).toBeNull())
  })
})

describe('venue deals', () => {
  it('shows each venue\'s actual deal and results; the what-if changes nothing stored', async () => {
    settings()
    localStorage.setItem('inflow:period', JSON.stringify({ preset: 'year' }))
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    await go('#/reports/deals')
    const total = await screen.findByLabelText('Venue deals in total')
    for (const k of ['Revenue', 'Paid to venues', 'You kept']) expect(within(total).getByText(k)).toBeTruthy()
    const loft = within(screen.getByLabelText('Venues')).getByRole('article', { name: 'Casa Verde loft' })
    expect(within(loft).getByText('Fixed fee · 600 lei a session')).toBeTruthy()
    expect(within(loft).getByText(/Fee covered at/)).toBeTruthy()
    const before = JSON.stringify((await store.get<{ venues: unknown[] }>('demo'))!.venues)
    await user.click(within(loft).getByText('What if…'))
    await user.click(within(loft).getByRole('radio', { name: 'Fixed fee' }))
    const fee = within(loft).getByLabelText('Fee a session (lei)')
    await user.clear(fee)
    await user.type(fee, '800')
    // 9 evenings at 800 instead of 600: 1,800 lei less.
    expect(within(loft).getByText(/−1,800 lei/)).toBeTruthy()
    expect(JSON.stringify((await store.get<{ venues: unknown[] }>('demo'))!.venues)).toBe(before)
    // No verdicts, no commentary cards.
    expect(screen.queryByText(/Keep, watch|Too early|Rethink/)).toBeNull()
  })
})

describe('clients & work', () => {
  it('ranks clients by what was kept, switches to work type, and opens a breakdown', async () => {
    settings()
    localStorage.setItem('inflow:period', JSON.stringify({ preset: 'year' }))
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    await go('#/reports/earnings')
    const total = await screen.findByLabelText('Earnings in total')
    for (const k of ['Income', 'Costs', 'You kept']) expect(within(total).getByText(k)).toBeTruthy()
    const list = screen.getByLabelText('Clients, most kept first')
    const items = within(list).getAllByRole('listitem').filter((li) => li.parentElement?.tagName === 'OL')
    expect(items.length).toBeGreaterThan(3)
    expect(within(items[0]).getByText(/sessions? · .* a session/)).toBeTruthy()
    await user.click(screen.getByRole('radio', { name: 'Work' }))
    const work = screen.getByLabelText('Work types, most kept first')
    await user.click(within(work).getByText('Workshop'))
    const row = within(work).getByText('Workshop').closest('li')!
    expect(row.querySelector('details')!.open).toBe(true)
    expect(within(row).getByText('Venue fees')).toBeTruthy()
    expect(within(row).getByText(/a session on average · from/)).toBeTruthy()
    expect(within(row).getByText('Casa Verde loft')).toBeTruthy()
    // No grid, no question chips, no filter button on this report.
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByRole('button', { name: /Filter/ })).toBeNull()
  })

  it('ignores a report filter left set elsewhere: the period is its only filter', async () => {
    settings()
    localStorage.setItem('inflow:period', JSON.stringify({ preset: 'year' }))
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    await go('#/reports/earnings')
    const before = within(await screen.findByLabelText('Earnings in total')).getAllByText(/lei$/).map((x) => x.textContent).join()
    cleanup()
    localStorage.setItem('inflow:report-scope', JSON.stringify({ clientId: 'demo_c_radu', sourceId: '', venueId: '', activity: '' }))
    render(<App store={store} today={today} />)
    await go('#/reports/earnings')
    const after = within(await screen.findByLabelText('Earnings in total')).getAllByText(/lei$/).map((x) => x.textContent).join()
    expect(after).toBe(before)
  })

  it('works out the break-even on a fixed-fee venue from a price per person', async () => {
    settings()
    localStorage.setItem('inflow:period', JSON.stringify({ preset: 'year' }))
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    await go('#/reports/deals')
    const loft = await screen.findByRole('article', { name: 'Casa Verde loft' })
    await user.click(within(loft).getByText('Break-even'))
    const price = within(loft).getByLabelText('Price per person (lei)') as HTMLInputElement
    expect(price.value).toBe('220')
    expect(within(loft).getByText(/people cover the 600 lei fee/).textContent).toContain('3')
    await user.clear(price)
    await user.type(price, '100')
    expect(within(loft).getByText(/From person 7 on/)).toBeTruthy()
  })
})

describe('insight feedback', () => {
  it('hides an insight with 👎, undoes it, mutes a rule, and Settings brings them back', async () => {
    settings()
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    const panel = screen.getByLabelText('Worth a look')
    const first = within(panel).getAllByRole('listitem')[0]
    const title = first.querySelector('b')!.textContent!
    await user.click(within(first).getByRole('button', { name: 'Not useful' }))
    await user.click(within(first).getByRole('button', { name: 'Hide this one' }))
    expect(within(screen.getByLabelText('Worth a look')).queryByText(title)).toBeNull()
    await user.click(await screen.findByRole('button', { name: 'Undo' }))
    expect(within(screen.getByLabelText('Worth a look')).getByText(title)).toBeTruthy()
    // Hide all like it, then bring everything back from Settings.
    const again = within(screen.getByLabelText('Worth a look')).getAllByRole('listitem')[0]
    await user.click(within(again).getByRole('button', { name: 'Not useful' }))
    await user.click(within(again).getByRole('button', { name: /Hide all about/ }))
    expect(within(screen.getByLabelText('Worth a look')).queryByText(title)).toBeNull()
    await go('#/settings')
    await user.click(screen.getByRole('button', { name: 'Show them again' }))
    await go('#/overview')
    expect(within(await screen.findByLabelText('Worth a look')).getByText(title)).toBeTruthy()
  })

  it('👍 keeps an insight first', async () => {
    settings()
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    const items = within(screen.getByLabelText('Worth a look')).getAllByRole('listitem')
    const third = items[2].querySelector('b')!.textContent!
    await user.click(within(items[2]).getByRole('button', { name: 'Useful' }))
    expect(within(screen.getByLabelText('Worth a look')).getAllByRole('listitem')[0].querySelector('b')!.textContent).toBe(third)
  })
})

describe('switching between the demo and Notion', () => {
  const mineInNotion: InflowData = {
    records: [{ ...buildDemo(today).records.find((r) => r.status === 'received' && r.date.startsWith('2026-11'))!, id: 'notion1', clientId: null, sourceId: null, venueId: null, demo: undefined, amount: 1234, amountRon: 1234, currency: 'RON', fxRate: 1 }],
    costs: [], clients: [], sources: [], venues: [],
  }
  const fakeNotion = (load: () => Promise<InflowData>) => {
    const writes = vi.fn()
    const repo: Repo = {
      kind: 'notion', load,
      saveRecord: async (r) => { writes('saveRecord'); return r }, deleteRecord: async () => { writes('deleteRecord') },
      saveCost: async (c) => { writes('saveCost'); return c }, deleteCost: async () => { writes('deleteCost') },
      saveEntity: async (_k, e) => { writes('saveEntity'); return e }, deleteEntity: async () => { writes('deleteEntity') },
    }
    return { repo, writes }
  }
  const notionSettings = { mode: 'notion', notionToken: 'ntn_x', incomeDbId: 'abc', workspace: 'mine', demoSeeded: true }

  it('keeps the connection, writes nothing to Notion from the demo, and comes back to Notion', async () => {
    settings(notionSettings)
    const { repo, writes } = fakeNotion(async () => mineInNotion)
    const user = userEvent.setup()
    render(<App store={store} today={today} notionRepo={repo} />)
    await waitFor(() => expect(screen.getByTestId('period-total').textContent).toMatch(/^1[.,]?234/))
    await go('#/settings')
    await user.click(screen.getByRole('radio', { name: 'Demo practice' }))
    await go('#/overview')
    // Add and delete in the demo.
    await user.click(await screen.findByRole('button', { name: /Add income/ }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Amount'), '77')
    await user.click(within(dialog).getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(writes).not.toHaveBeenCalled()
    const kept = JSON.parse(localStorage.getItem(SETTINGS_KEY)!)
    expect([kept.mode, kept.notionToken, kept.incomeDbId]).toEqual(['notion', 'ntn_x', 'abc'])
    await user.click(screen.getByRole('button', { name: 'Switch to my data' }))
    await waitFor(() => expect(screen.getByTestId('period-total').textContent).toMatch(/^1[.,]?234/))
    expect(screen.getByText('Notion')).toBeTruthy()
  })

  it('a Notion load that finishes after switching to the demo does not replace the demo', async () => {
    settings(notionSettings)
    let n = 0
    let finish: (d: InflowData) => void = () => {}
    // The first load answers at once; the next one hangs until released.
    const { repo } = fakeNotion(() => (n++ === 0 ? Promise.resolve(mineInNotion) : new Promise((res) => { finish = res })))
    const user = userEvent.setup()
    render(<App store={store} today={today} notionRepo={repo} />)
    await waitFor(() => expect(screen.getByTestId('period-total').textContent).toMatch(/^1[.,]?234/))
    await go('#/settings')
    await user.click(screen.getByRole('radio', { name: 'Demo practice' }))
    await user.click(screen.getByRole('radio', { name: 'My data' })) // starts the second, slow load
    await user.click(screen.getByRole('radio', { name: 'Demo practice' }))
    await go('#/overview')
    const demoTotal = (await screen.findByTestId('period-total')).textContent
    expect(demoTotal).not.toMatch(/^1[.,]?234/)
    await act(async () => { finish(mineInNotion) })
    expect(screen.getByTestId('period-total').textContent).toBe(demoTotal)
  })
})

describe('feature switches', () => {
  const off = (key: FeatureKey) => settings({ features: { ...ALL_FEATURES, [key]: false } })
  const reportTabs = async () => {
    await go('#/reports')
    const nav = await screen.findByRole('navigation', { name: 'Reports' })
    const tabs = within(nav).getAllByRole('link').map((a) => a.textContent ?? '')
    // The second row: Breakdown's dimensions, Profit's P&L and cash flow.
    await go('#/reports/pnl')
    const sub = within(screen.getByRole('navigation', { name: 'Reports' })).getAllByRole('link').map((a) => a.textContent ?? '')
    return [...new Set([...tabs, ...sub])]
  }

  it('someone who has used InFlow keeps every feature they had on', async () => {
    settings()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    expect(screen.getByLabelText('Worth a look')).toBeTruthy()
    expect(screen.getByLabelText('Target')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Costs/ })).toBeTruthy()
    expect(screen.queryByLabelText('Simple start')).toBeNull()
    const tabs = await reportTabs()
    for (const t of ['Review', 'Clients & work', 'Venue deals', 'Profit', 'P&L', 'Cash flow', 'Tax*', 'Print']) expect(tabs).toContain(t)
    // Breakdown and its filter bar are folded into Clients & work.
    expect(tabs).not.toContain('Breakdown')
    expect(screen.queryByRole('button', { name: /Filter/ })).toBeNull()
  })

  it('a new user starts simple, is told so, and can turn everything on at once', async () => {
    // Nothing stored: a first visit. The tour is closed so the Overview shows.
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await user.click(await screen.findByRole('button', { name: 'Skip' }))
    const notice = await screen.findByLabelText('Simple start')
    expect(within(notice).getByText(/Costs, tax, venue deals/)).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Costs/ })).toBeNull()
    expect(await reportTabs()).not.toContain('Venue deals')
    await go('#/overview')
    await user.click(within(screen.getByLabelText('Simple start')).getByRole('button', { name: 'Turn everything on' }))
    expect(screen.queryByLabelText('Simple start')).toBeNull()
    expect(screen.getByRole('link', { name: /Costs/ })).toBeTruthy()
    // The master switch turns them all off, and back to simple.
    await go('#/settings')
    await user.click(screen.getByRole('checkbox', { name: /^Everything/ }))
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!).features).toEqual({ tax: false, costs: false, deals: false, insights: false, expected: false, currencies: false, printable: false })
    await user.click(screen.getByRole('button', { name: 'Back to simple start' }))
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!).features.insights).toBe(true)
  })

  it('old Breakdown links open Clients & work on that view', async () => {
    settings()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    await go('#/reports/venues')
    expect(await screen.findByLabelText('Venues, most kept first')).toBeTruthy()
  })

  it('insights off: no Overview panel, no Insights report', async () => {
    off('insights')
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    expect(screen.queryByLabelText('Worth a look')).toBeNull()
    await go('#/reports/insights')
    // The review stays (summary, movers, who pays); its insight sections go.
    expect(await screen.findByLabelText('Main movers')).toBeTruthy()
    expect(screen.queryByLabelText('Pain points and wins')).toBeNull()
  })

  it('venue deals off: no report, no deal fields, no head count', async () => {
    off('deals')
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    expect(await reportTabs()).not.toContain('Venue deals')
    await go('#/overview')
    await user.click(screen.getByRole('button', { name: /Add income/ }))
    expect(within(await screen.findByRole('dialog')).queryByLabelText(/People who came/)).toBeNull()
  })

  it('costs off: no Costs tab, P&L, cash flow or break-even', async () => {
    off('costs')
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    expect(screen.queryByRole('link', { name: /Costs/ })).toBeNull()
    expect(screen.queryByLabelText('What you kept')).toBeNull()
    const tabs = await reportTabs()
    expect(tabs).not.toContain('Profit')
    expect(tabs).not.toContain('Cash flow')
  })

  it('tax off: no tax panel or report', async () => {
    off('tax')
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    expect(screen.queryByLabelText('Taxable or not')).toBeNull()
    expect(await reportTabs()).not.toContain('Tax*')
  })

  it('expected off: no Expected panel and no status choice', async () => {
    off('expected')
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    expect(screen.queryByLabelText('Expected payments')).toBeNull()
    await user.click(screen.getByRole('button', { name: /Add income/ }))
    expect(within(await screen.findByRole('dialog')).queryByLabelText('Status')).toBeNull()
  })

  it('currencies off: amounts in lei only', async () => {
    off('currencies')
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    await user.click(screen.getByRole('button', { name: /Add income/ }))
    expect(within(await screen.findByRole('dialog')).queryByLabelText('Currency')).toBeNull()
  })

  it('target, unusual flags, filters and printable off: each goes', async () => {
    settings({ features: { ...ALL_FEATURES, targets: false, unusual: false, reportTools: false, printable: false } })
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    expect(screen.queryByLabelText('Target')).toBeNull()
    expect(screen.queryByLabelText('Unusually large')).toBeNull()
    expect(await reportTabs()).not.toContain('Print')
  })

  it('Settings lists every feature with an explanation, and a switch takes effect at once', async () => {
    settings()
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    await go('#/settings')
    expect(screen.getAllByText('What this does')).toHaveLength(Object.keys(ALL_FEATURES).length)
    await user.click(screen.getByRole('checkbox', { name: /Costs, P&L and cash flow/ }))
    expect(screen.queryByRole('link', { name: /Costs/ })).toBeNull()
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!).features.costs).toBe(false)
  })
})
