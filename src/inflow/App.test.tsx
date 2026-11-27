// @vitest-environment jsdom
// The whole app on an in-memory store with the demo seeded, driven the way a
// person would: the tour, the dashboard, adding a payment, tax switched off,
// the printable report, clearing the demo.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { memoryStore, type KeyValueStore } from '../shared/kvStore'
import App from './App'
import { ALL_FEATURES, loadSettings, SETTINGS_KEY } from './store/settings'
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

/** The client field is a search box: type the first name, pick the match. */
async function chooseClient(user: ReturnType<typeof userEvent.setup>, scope: Pick<typeof screen, 'getByRole' | 'findByRole'>, name: string) {
  const box = scope.getByRole('combobox', { name: 'Client' })
  await user.click(box)
  await user.type(box, name.split(' ')[0])
  await user.click(await scope.findByRole('option', { name: new RegExp(`^${name}`) }))
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
  it('shows the tour on first run; Skip dismisses it for good (audit B-08)', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App store={store} today={today} />)
    expect(await screen.findByText('Welcome to InFlow')).toBeTruthy()
    expect((screen.getByLabelText(/Show this guide next time/) as HTMLInputElement).checked).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Skip' }))
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!).showTour).toBe(false)
    unmount()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    expect(screen.queryByText('Welcome to InFlow')).toBeNull()
  })

  it('completing the tour with its box ticked brings it back next time', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<App store={store} today={today} />)
    await screen.findByText('Welcome to InFlow')
    await user.click(screen.getByLabelText(/Show this guide next time/))
    for (let i = 0; i < 8; i++) await user.click(screen.getByRole('button', { name: 'Next', exact: true } as never))
    await user.click(screen.getByRole('button', { name: 'Start', exact: true } as never))
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!).showTour).toBe(true)
    unmount()
    render(<App store={store} today={today} />)
    expect(await screen.findByText('Welcome to InFlow')).toBeTruthy()
  })

  it('opens on a dashboard built from the seeded demo', async () => {
    settings()
    render(<App store={store} today={today} />)
    const total = await screen.findByTestId('period-total')
    expect(total.textContent).toMatch(/lei$/)
    expect(total.textContent).not.toBe('0 lei')
    expect(screen.getByText('Where it came from')).toBeTruthy()
    expect(screen.getByText(/Set aside for tax/)).toBeTruthy()
    // Tax shows only once switched on, so it carries no "optional" badge.
    expect(screen.queryByText('Optional')).toBeNull()
  })

  it('adds a payment with the tax folded away as an optional suggestion', async () => {
    settings()
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    await user.click(screen.getByRole('button', { name: /Add income/ }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText('Amount'), '750')
    await chooseClient(user, within(dialog), 'Andreea Vlad')
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
    expect(screen.queryByRole('radio', { name: 'Tax' })).toBeNull()
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
    await chooseClient(user, screen, 'Andreea Vlad')
    // The preview settles a moment after a change (audit G-01).
    await waitFor(() => expect(screen.getByTitle('Report preview').getAttribute('srcdoc')).toContain('Andreea Vlad'))
    // Adjust: a section off leaves the print.
    await user.click(screen.getByRole('radio', { name: /Year in review/ }))
    await user.click(screen.getByText('Adjust this report'))
    await user.click(screen.getByLabelText('By venue'))
    await waitFor(() => expect((screen.getByTitle('Report preview') as HTMLIFrameElement).getAttribute('srcdoc')).not.toContain('By venue'))
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
    await chooseClient(user, within(dialog), 'Radu Stoica')
    const chips = within(within(dialog).getByLabelText('Usual amounts')).getAllByRole('button')
    expect(chips.length).toBeGreaterThan(0)
    await user.click(chips[0])
    expect((within(dialog).getByLabelText('Amount') as HTMLInputElement).value).not.toBe('')
    await user.clear(within(dialog).getByLabelText('Description'))
    expect((within(dialog).getByLabelText('Description') as HTMLInputElement).placeholder).toContain(' · ')
  })

  it('adds a client from what was typed, the name already filled in', async () => {
    settings()
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    await user.click(screen.getByRole('button', { name: /Add income/ }))
    const dialog = await screen.findByRole('dialog')
    const box = within(dialog).getByRole('combobox', { name: 'Client' })
    await user.click(box)
    await user.type(box, 'Maria Pop')
    await user.click(await within(dialog).findByRole('option', { name: /Add “Maria Pop”/ }))
    const editor = await screen.findByRole('dialog', { name: 'New client' })
    expect((within(editor).getByLabelText('Name') as HTMLInputElement).value).toBe('Maria Pop')
  })

  it('hides field hints once switched off, but never a live figure', async () => {
    settings({ showHints: false })
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    await user.click(screen.getByRole('button', { name: /Add income/ }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByText(/A 4-session package/)).toBeNull()
    // Live: the per-head figure still shows once people are entered.
    await user.selectOptions(within(dialog).getByLabelText('Venue'), within(dialog).getByRole('option', { name: 'Casa Verde loft' }))
    await user.type(within(dialog).getByLabelText(/People per session/), '10')
    expect(within(dialog).getByText(/10 × 150 lei/)).toBeTruthy()
  })

  it('folds the tax section of a payment back after opening it', async () => {
    settings()
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    await user.click(screen.getByRole('button', { name: /Add income/ }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /^Tax/, expanded: false }))
    expect(within(dialog).getByLabelText(/Taxable\?/)).toBeTruthy()
    await user.click(within(dialog).getByRole('button', { name: /^Tax/, expanded: true }))
    expect(within(dialog).queryByLabelText(/Taxable\?/)).toBeNull()
  })

  it('opens a P&L cost line into its categories in place', async () => {
    settings()
    localStorage.setItem('inflow:period', JSON.stringify({ preset: 'year' }))
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    await go('#/reports/pnl')
    const line = await screen.findByRole('button', { name: /Running costs/ })
    expect(screen.queryByText('Rent')).toBeNull()
    await user.click(line)
    expect(line.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Rent')).toBeTruthy()
  })

  it('asks before saving an extra zero, fixes it in one tap, and still lets you save as typed', async () => {
    settings()
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    await user.click(screen.getByRole('button', { name: /Add income/ }))
    const dialog = await screen.findByRole('dialog')
    await chooseClient(user, within(dialog), 'Ioana Marinescu')
    const amount = within(dialog).getByLabelText('Amount') as HTMLInputElement
    await user.clear(amount)
    await user.type(amount, '10000')
    await user.click(within(dialog).getByRole('button', { name: 'Add' }))
    const box = await within(dialog).findByRole('alert', { name: 'Worth a second look' })
    expect(within(box).getByText(/extra zero/)).toBeTruthy()
    await user.click(within(box).getByRole('button', { name: /Make it/ }))
    expect(amount.value).toBe('1000')
    expect(within(dialog).queryByRole('alert', { name: 'Worth a second look' })).toBeNull()
    await user.click(within(dialog).getByRole('button', { name: 'Add' }))
    expect(await screen.findByText(/Added 1,000/)).toBeTruthy()
  })

  it('turns the head count into an amount at a venue with a known price per head', async () => {
    settings()
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    await user.click(screen.getByRole('button', { name: /Add income/ }))
    const dialog = await screen.findByRole('dialog')
    await user.selectOptions(within(dialog).getByLabelText('Venue'), within(dialog).getByRole('option', { name: 'Casa Verde loft' }))
    await user.type(within(dialog).getByLabelText(/People per session/), '10')
    expect(within(dialog).getByText(/10 × 150 lei/)).toBeTruthy()
    await user.click(within(dialog).getByRole('button', { name: 'Use' }))
    expect((within(dialog).getByLabelText('Amount') as HTMLInputElement).value).toBe('1500')
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

describe('marking expected payments received, from every screen (audit B-02, B-03, E-01)', () => {
  const stored = async () => (await store.get<InflowData>('demo'))!.records
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ rates: { RON: 6.02 } }) }))) })
  afterEach(() => { vi.unstubAllGlobals() })

  it('Overview: one tap marks it received today, with a tax reserve suggested', async () => {
    settings()
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    const before = (await stored()).find((r) => r.description.startsWith('Team-lead coaching circle — next invoice'))!
    await user.click(screen.getByRole('button', { name: /Mark Team-lead coaching circle — next invoice received/ }))
    await waitFor(async () => expect((await stored()).find((r) => r.id === before.id)!.status).toBe('received'))
    const after = (await stored()).find((r) => r.id === before.id)!
    expect(after.date).toBe(today)
    expect(after.taxReserve).toBeGreaterThan(0)
    expect(after.reserveSource).toBe('suggested')
  })

  it('a foreign-currency payment is booked at the rate of the day it arrives, not the day it was expected', async () => {
    settings()
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    const gbp = (await stored()).find((r) => r.status === 'expected' && r.currency === 'GBP')!
    expect(gbp.fxRate).not.toBe(6.02)
    await user.click(screen.getByRole('button', { name: new RegExp(`Mark ${gbp.description} received`) }))
    await waitFor(async () => expect((await stored()).find((r) => r.id === gbp.id)!.status).toBe('received'))
    const after = (await stored()).find((r) => r.id === gbp.id)!
    expect(after.fxRate).toBe(6.02)
    expect(after.amountRon).toBeCloseTo(gbp.amount * 6.02, 2)
  })

  it('Income: part of a payment received, the balance still expected, nothing recreated by hand', async () => {
    settings()
    localStorage.setItem('inflow:period', JSON.stringify({ preset: 'year' }))
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    await go('#/income')
    const q1 = (await stored()).find((r) => r.description === 'Leadership workshop — Q1 booking')!
    await user.click(await screen.findByRole('button', { name: /Part of Leadership workshop — Q1 booking received/ }))
    const dialog = await screen.findByRole('dialog', { name: 'Part received' })
    await user.type(within(dialog).getByLabelText(/Amount received/), '3000')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))
    await waitFor(async () => expect((await stored()).find((r) => r.id === q1.id)!.amount).toBe(q1.amount - 3000))
    const rs = await stored()
    expect(rs.find((r) => r.id === q1.id)).toMatchObject({ status: 'expected', sessions: 0 })
    expect(rs.find((r) => r.status === 'received' && r.description === q1.description && r.amount === 3000)).toMatchObject({ date: today })
  })

  it('the form: a foreign-currency expected payment switched to Received takes the day’s rate and a reserve (B-03 form path)', async () => {
    settings()
    localStorage.setItem('inflow:period', JSON.stringify({ preset: 'year' }))
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    await go('#/income')
    const gbp = (await stored()).find((r) => r.status === 'expected' && r.currency === 'GBP')!
    expect(gbp.fxRate).not.toBe(6.02)
    await user.click(await screen.findByRole('button', { name: new RegExp(`^${gbp.description.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, `) }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit payment' })
    await user.selectOptions(within(dialog).getByLabelText(/^Status/), 'received')
    await waitFor(() => expect((within(dialog).getByLabelText(/^Lei per 1 GBP/) as HTMLInputElement).value).toBe('6.02'))
    await user.click(within(dialog).getByRole('button', { name: /^(Save|Save anyway)$/ }))
    const again = within(dialog).queryByRole('button', { name: 'Save anyway' })
    if (again) await user.click(again)
    await waitFor(async () => expect((await stored()).find((r) => r.id === gbp.id)!.status).toBe('received'))
    const after = (await stored()).find((r) => r.id === gbp.id)!
    expect([after.fxRate, after.date]).toEqual([6.02, today])
    expect(after.amountRon).toBeCloseTo(gbp.amount * 6.02, 2)
    expect(after.taxReserve).toBeGreaterThan(0)
  })

  it('the form: part of an expected payment received, through the same rule as Overview and Income', async () => {
    settings()
    localStorage.setItem('inflow:period', JSON.stringify({ preset: 'year' }))
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    await go('#/income')
    const q1 = (await stored()).find((r) => r.description === 'Leadership workshop — Q1 booking')!
    await user.click(await screen.findByRole('button', { name: /^Leadership workshop — Q1 booking, / }))
    const form = await screen.findByRole('dialog', { name: 'Edit payment' })
    await user.click(within(form).getByRole('button', { name: /Part of Leadership workshop — Q1 booking received/ }))
    const part = await screen.findByRole('dialog', { name: 'Part received' })
    await user.type(within(part).getByLabelText(/Amount received/), '3000')
    await user.click(within(part).getByRole('button', { name: 'Save' }))
    await waitFor(async () => expect((await stored()).find((r) => r.id === q1.id)!.amount).toBe(q1.amount - 3000))
    expect((await stored()).find((r) => r.id === q1.id)).toMatchObject({ status: 'expected', sessions: 0 })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Edit payment' })).toBeNull())
  })

  it('the form: switching an expected payment to Received sets today, and suggests a reserve', async () => {
    settings()
    localStorage.setItem('inflow:period', JSON.stringify({ preset: 'year' }))
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    await go('#/income')
    const q1 = (await stored()).find((r) => r.description === 'Leadership workshop — Q1 booking')!
    await user.click(await screen.findByRole('button', { name: new RegExp(`^Leadership workshop — Q1 booking`) }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit payment' })
    await user.selectOptions(within(dialog).getByLabelText(/^Status/), 'received')
    await user.click(within(dialog).getByRole('button', { name: /^(Save|Save anyway)$/ }))
    const again = within(dialog).queryByRole('button', { name: 'Save anyway' })
    if (again) await user.click(again)
    await waitFor(async () => expect((await stored()).find((r) => r.id === q1.id)!.status).toBe('received'))
    const after = (await stored()).find((r) => r.id === q1.id)!
    expect(after.date).toBe(today)
    expect(after.taxReserve).toBeGreaterThan(0)
  })
})

describe('refunds (from the payment itself)', () => {
  const stored = async () => (await store.get<InflowData>('demo'))!.records
  it('off by default: a received payment offers no refund, and nothing about refunds shows', async () => {
    settings()
    localStorage.setItem('inflow:period', JSON.stringify({ preset: 'year' }))
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    await go('#/income')
    const p = (await stored()).filter((r) => r.status === 'received' && r.date.startsWith('2026-11'))[0]
    await user.click((await screen.findAllByRole('button', { name: new RegExp(`, ${p.date}$`) }))[0])
    const form = await screen.findByRole('dialog', { name: 'Edit payment' })
    expect(within(form).queryByRole('button', { name: 'Refund…' })).toBeNull()
    expect(within(form).queryByRole('region', { name: 'Refunds' })).toBeNull()
  })

  it('refunds part of a payment from its form: the payment stays, the refund is listed in its month and on the payment', async () => {
    settings({ features: { ...ALL_FEATURES } })
    localStorage.setItem('inflow:period', JSON.stringify({ preset: 'year' }))
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    await go('#/income')
    const p = (await stored()).filter((r) => r.status === 'received' && r.currency === 'RON' && r.date.startsWith('2026-11')).sort((a, b) => b.amount - a.amount)[0]
    await user.click((await screen.findAllByRole('button', { name: new RegExp(`^${p.description.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, `) })).find((b) => b.getAttribute('aria-label')!.includes(p.date))!)
    const form = await screen.findByRole('dialog', { name: 'Edit payment' })
    await user.click(within(form).getByRole('button', { name: 'Refund…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Refund' })
    const amount = within(dialog).getByLabelText(/Amount paid back/)
    await user.clear(amount)
    await user.type(amount, String(p.amount + 1))
    await user.click(within(dialog).getByRole('button', { name: 'Save refund' }))
    expect((await within(dialog).findByRole('alert')).textContent).toMatch(/more than/)
    await user.clear(amount)
    await user.type(amount, '100')
    await user.click(within(dialog).getByRole('button', { name: 'Save refund' }))
    await waitFor(async () => expect(((await store.get('demo')) as InflowData).refunds).toHaveLength(1))
    expect((await stored()).find((r) => r.id === p.id)).toEqual(p)
    await waitFor(() => expect(within(form).getByRole("region", { name: "Refunds" }).textContent).toMatch(/Refunded 100 lei on/))
    expect(screen.queryByRole('dialog', { name: 'Refund' })).toBeNull()
    // The payment's own form never saved: still open, unchanged.
    expect(screen.getByRole('dialog', { name: 'Edit payment' })).toBeTruthy()
    await user.click(within(form).getByRole('button', { name: 'Cancel' }))
    expect(await screen.findByRole('button', { name: new RegExp(`^Refund: .*minus 100 lei`) })).toBeTruthy()
    expect(screen.getAllByText('Partly refunded').length).toBeGreaterThan(0)
  })
})

describe('estimated available to spend (audit F-01)', () => {
  it('sits under the period’s income, not in its place, and opens to show how it is worked out', async () => {
    settings()
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    const panel = screen.getByRole('region', { name: 'Available to spend' })
    expect(within(panel).getByTestId('available').textContent).toMatch(/lei/)
    await user.click(panel.querySelector('summary')!)
    expect(within(panel).getByText(/^Received since/)).toBeTruthy()
    expect(within(panel).getByText(/Tax still owed/)).toBeTruthy()
    expect(within(panel).getByText(/Expected payments are left out/)).toBeTruthy()
  })
})

describe('stage 6: shorter form, more ways in', () => {
  const stored = async () => (await store.get<InflowData>('demo'))!

  it('the payment form shows every field at once: amount, client and date first, nothing folded away', async () => {
    settings({ features: { ...ALL_FEATURES } })
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    await user.click(screen.getByRole('button', { name: /Add income/ }))
    const dialog = await screen.findByRole('dialog')
    for (const label of [/^Amount/, /^Date/, /^Description/, /^Sessions/, /^Hours/, /^Source/, /^Venue/, /^Activity/, /^Notes/]) expect(within(dialog).getByLabelText(label)).toBeTruthy()
    expect(within(dialog).getByRole('combobox', { name: 'Client' })).toBeTruthy()
    expect(within(dialog).queryByRole('button', { name: /More details/ })).toBeNull()
    // Amount, client and date still come first.
    const order = [within(dialog).getByLabelText(/^Amount/), within(dialog).getByRole('combobox', { name: 'Client' }), within(dialog).getByLabelText(/^Date/), within(dialog).getByLabelText(/^Description/)]
    for (let k = 1; k < order.length; k++) expect(order[k - 1].compareDocumentPosition(order[k]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('a cost added from a venue’s row in Venue deals starts at that venue, as room hire (E-04)', async () => {
    settings({ features: { ...ALL_FEATURES } })
    localStorage.setItem('inflow:period', JSON.stringify({ preset: 'year' }))
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    await go('#/reports/deals')
    const add = (await screen.findAllByRole('button', { name: /^\+ Add a cost at / }))[0]
    const venue = add.textContent!.replace('+ Add a cost at ', '')
    await user.click(add)
    const dialog = await screen.findByRole('dialog')
    const pick = within(dialog).getByLabelText(/^Venue/) as HTMLSelectElement
    expect(pick.selectedOptions[0].textContent).toBe(venue)
    expect((within(dialog).getByLabelText(/^Category/) as HTMLSelectElement).value).toBe('venue_hire')
  })

  it('the Overview offers a cost too (E-02)', async () => {
    settings({ features: { ...ALL_FEATURES } })
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    await user.click(within(screen.getByRole('region', { name: 'Available to spend' })).getByRole('button', { name: /Add a cost/ }))
    expect(await screen.findByRole('dialog', { name: /cost/i })).toBeTruthy()
  })

  it('after saving an expected payment, the toast offers a calendar reminder for its due date', async () => {
    settings()
    const user = userEvent.setup()
    const made: string[] = []
    const url = vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => { void (b as Blob).text().then((t) => made.push(t)); return 'blob:x' })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    await user.click(screen.getByRole('button', { name: /Add income/ }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/^Amount/), '900')
    const date = within(dialog).getByLabelText(/^Date/)
    await user.clear(date)
    await user.type(date, '2026-12-15')
    await user.selectOptions(within(dialog).getByLabelText(/^Status/), 'expected')
    await user.click(within(dialog).getByRole('button', { name: /^(Add|Save anyway)$/ }))
    const again = within(dialog).queryByRole('button', { name: 'Save anyway' })
    if (again) await user.click(again)
    await user.click(await screen.findByRole('button', { name: 'Remind me' }))
    await waitFor(() => expect(made.join('')).toContain('DTSTART;VALUE=DATE:20261215'))
    url.mockRestore()
  })

  it('a reimbursement can name the cost it repays; the cost then shows as reimbursed', async () => {
    settings({ features: { ...ALL_FEATURES } })
    localStorage.setItem('inflow:period', JSON.stringify({ preset: 'year' }))
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    await user.click(screen.getByRole('button', { name: /Add income/ }))
    const dialog = await screen.findByRole('dialog')
    await user.type(within(dialog).getByLabelText(/^Amount/), '120')
    await user.selectOptions(within(dialog).getByLabelText(/^Activity/), 'reimbursement')
    const pick = within(dialog).getByLabelText(/^Repays which cost/) as HTMLSelectElement
    const cost = pick.options[1]
    await user.selectOptions(pick, cost.value)
    await user.click(within(dialog).getByRole('button', { name: /^(Add|Save anyway)$/ }))
    const again = within(dialog).queryByRole('button', { name: 'Save anyway' })
    if (again) await user.click(again)
    await waitFor(async () => expect((await stored()).records.some((r) => r.repaysCostId === cost.value)).toBe(true))
  })

  it('a long Income list is drawn a page at a time, totals still covering all of it (G-04)', async () => {
    settings({ workspace: 'mine', demoSeeded: true })
    localStorage.setItem('inflow:period', JSON.stringify({ preset: 'year' }))
    const demo = buildDemo(today)
    const base = { ...demo.records.find((r) => r.status === 'received')!, demo: undefined, clientId: null, sourceId: null, venueId: null, category: 'workshop' as const }
    const many = Array.from({ length: 450 }, (_, i) => ({ ...base, id: `loc_${i}`, description: `Session ${i}`, date: `2026-${String(1 + (i % 10)).padStart(2, '0')}-${String(1 + (i % 27)).padStart(2, '0')}`, amount: 100, amountRon: 100, currency: 'RON' as const, fxRate: 1 }))
    await store.set('data', { records: many, costs: [], clients: [], sources: [], venues: [], refunds: [] })
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await go('#/income')
    expect(await screen.findByText(/450 payments · 45,000 lei earned/)).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /^Session \d+, / })).toHaveLength(200)
    await user.click(screen.getByRole('button', { name: /Show 200 more of 250/ }))
    expect(screen.getAllByRole('button', { name: /^Session \d+, / })).toHaveLength(400)
    await user.click(screen.getByRole('button', { name: /Show 50 more of 50/ }))
    expect(screen.getAllByRole('button', { name: /^Session \d+, / })).toHaveLength(450)
  })
})

describe('optional parts stay out of the way until wanted', () => {
  it('Refunds starts off for a new user and for someone who has used InFlow before; Everything turns it on', () => {
    localStorage.clear()
    expect(loadSettings().features.refunds).toBe(false)
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ showTour: false, features: { tax: true } }))
    expect(loadSettings().features.refunds).toBe(false)
    expect(loadSettings().features.costs).toBe(true)
    expect(ALL_FEATURES.refunds).toBe(true)
  })

  it('switched off, a refund already recorded still shows on its payment, and counts', async () => {
    settings({ workspace: 'mine', demoSeeded: true })
    localStorage.setItem('inflow:period', JSON.stringify({ preset: 'year' }))
    const p = { ...buildDemo(today).records.find((r) => r.status === 'received' && r.currency === 'RON' && r.date.startsWith('2026-11'))!, id: 'loc_p', demo: undefined, clientId: null, sourceId: null, venueId: null }
    await store.set('data', { records: [p], costs: [], clients: [], sources: [], venues: [], refunds: [{ id: 'loc_f', paymentId: 'loc_p', date: p.date, amount: 10, currency: 'RON', fxRate: 1, amountRon: 10, notes: '' }] })
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await go('#/income')
    await user.click(await screen.findByRole('button', { name: new RegExp(`^${p.description.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, `) }))
    const form = await screen.findByRole('dialog', { name: 'Edit payment' })
    expect(within(form).getByRole('region', { name: 'Refunds' }).textContent).toMatch(/Refunded 10 lei/)
    expect(within(form).queryByRole('button', { name: /^Refund/ })).toBeNull()
  })

  it('a simple start shows no Available to spend: with tax and costs off it would only repeat what came in', async () => {
    localStorage.clear()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    expect(screen.queryByRole('region', { name: 'Available to spend' })).toBeNull()
  })
})

describe('a refunded payment, in its form (Release 1, D1/D2)', () => {
  it('locks status and currency, and refuses an amount below its refunds or a date after them', async () => {
    settings({ workspace: 'mine', demoSeeded: true, features: { ...ALL_FEATURES } })
    localStorage.setItem('inflow:period', JSON.stringify({ preset: 'year' }))
    const p = { ...buildDemo(today).records.find((r) => r.status === 'received' && r.currency === 'RON')!, id: 'loc_p', description: 'Refunded workshop', amount: 1000, amountRon: 1000, date: '2026-03-10', demo: undefined, clientId: null, sourceId: null, venueId: null }
    await store.set('data', { records: [p], costs: [], clients: [], sources: [], venues: [], refunds: [
      { id: 'loc_f1', paymentId: 'loc_p', date: '2026-04-01', amount: 300, currency: 'RON', fxRate: 1, amountRon: 300, notes: '' },
      { id: 'loc_f2', paymentId: 'loc_p', date: '2026-05-01', amount: 300, currency: 'RON', fxRate: 1, amountRon: 300, notes: '' }] })
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await go('#/income')
    await user.click(await screen.findByRole('button', { name: /^Refunded workshop, / }))
    const form = await screen.findByRole('dialog', { name: 'Edit payment' })
    expect((within(form).getByLabelText(/^Status/) as HTMLSelectElement).disabled).toBe(true)
    expect((within(form).getByLabelText(/^Currency/) as HTMLSelectElement).disabled).toBe(true)
    const amount = within(form).getByLabelText(/^Amount/)
    await user.clear(amount)
    await user.type(amount, '500')
    await user.click(within(form).getByRole('button', { name: /^(Save|Save anyway)$/ }))
    expect((await within(form).findByRole('alert')).textContent).toMatch(/totalling 600 RON/)
    await user.clear(amount)
    await user.type(amount, '1000')
    const date = within(form).getByLabelText(/^Date/)
    await user.clear(date)
    await user.type(date, '2026-04-15')
    await user.click(within(form).getByRole('button', { name: /^(Save|Save anyway)$/ }))
    expect((await within(form).findByRole('alert')).textContent).toMatch(/refunded on 2026-04-01/)
    const stored = (await store.get<InflowData>('data'))!
    expect(stored.records[0]).toMatchObject({ amount: 1000, date: '2026-03-10', status: 'received' })
    expect(stored.refunds).toHaveLength(2)
  })
})

describe('the P&L’s refunds line (acceptance review)', () => {
  it('opens under Revenue and shows the refunds of the period', async () => {
    settings({ workspace: 'mine', demoSeeded: true, features: { ...ALL_FEATURES } })
    localStorage.setItem('inflow:period', JSON.stringify({ preset: 'year' }))
    const p = { ...buildDemo(today).records.find((r) => r.status === 'received' && r.currency === 'RON')!, id: 'loc_p', amount: 1000, amountRon: 1000, date: '2026-03-10', demo: undefined, clientId: null, sourceId: null, venueId: null }
    await store.set('data', { records: [p], costs: [], clients: [], sources: [], venues: [], refunds: [{ id: 'loc_f', paymentId: 'loc_p', date: '2026-04-01', amount: 250, currency: 'RON', fxRate: 1, amountRon: 250, notes: '' }] })
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await go('#/reports/pnl')
    const toggle = await screen.findByRole('button', { name: /^Revenue/ })
    expect(screen.queryByText('of which refunds')).toBeNull()
    await user.click(toggle)
    const row = (await screen.findByText('of which refunds')).closest('tr')!
    expect(row.textContent).toMatch(/250/)
  })
})

describe('empty reports (audit C-04)', () => {
  it('with nothing recorded, a report says what it will show and how to start, instead of zeros', async () => {
    settings({ workspace: 'mine', demoSeeded: true })
    render(<App store={store} today={today} />)
    await go('#/reports/insights')
    const empty = await screen.findByRole('region', { name: 'Nothing to report yet' })
    expect(within(empty).getByRole('link', { name: 'Add your first payment' }).getAttribute('href')).toBe('#/add/income')
    expect(screen.queryByText(/0 lei/)).toBeNull()
    await go('#/reports/pnl')
    expect(await screen.findByRole('region', { name: 'Nothing to report yet' })).toBeTruthy()
  })
})

describe('audit conveniences', () => {
  it('on a custom range, break-even follows its days and fixed-window insights say so', async () => {
    settings()
    localStorage.setItem('inflow:period', JSON.stringify({ preset: 'custom', from: '2026-09-10', to: '2026-10-20' }))
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    await go('#/reports/pnl')
    expect(await screen.findByText('Break-even for 41 days')).toBeTruthy()
    expect(screen.queryByText(/this month/i)).toBeNull()
    await go('#/reports/insights')
    const act = await screen.findByLabelText('Pain points and wins')
    expect(within(act).getAllByText(/· past (6|12) months/).length).toBeGreaterThan(0)
  })

  it('suggests next month from a recurring client, adds it in one tap, or lets it go', async () => {
    settings()
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    const box = await screen.findByLabelText('Suggested from recurring payments')
    await user.click(within(box).getByRole('button', { name: /Expect Ioana/ }))
    expect(await screen.findByText(/Expected on/)).toBeTruthy()
    // Edit opens the new expected payment, its amount ready to adjust.
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(await screen.findByRole('dialog', { name: 'Edit payment' })).toBeTruthy()
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }))
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
    await user.type(screen.getByLabelText('Search income'), '5.000')
    const rows = await screen.findAllByRole('button', { name: /Team-lead coaching circle/ })
    expect(rows.length).toBeGreaterThan(5)
    expect(screen.queryByRole('button', { name: /Coaching session, 300/ })).toBeNull()
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
    expect(within(loft).getByText('Fixed fee · 400 lei a session')).toBeTruthy()
    expect(within(loft).getByText(/Fee covered at/)).toBeTruthy()
    const before = JSON.stringify((await store.get<{ venues: unknown[] }>('demo'))!.venues)
    await user.click(within(loft).getByText('What if…'))
    await user.click(within(loft).getByRole('radio', { name: 'Fixed fee' }))
    const fee = within(loft).getByLabelText('Fee a session (lei)')
    await user.clear(fee)
    await user.type(fee, '600')
    // 9 evenings at 600 instead of 400: 1,800 lei less.
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
    expect(price.value).toBe('150')
    expect(within(loft).getByText(/people cover the 400 lei fee/).textContent).toContain('3')
    await user.clear(price)
    await user.type(price, '100')
    expect(within(loft).getByText(/From person 5 on/)).toBeTruthy()
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
    costs: [], clients: [], sources: [], venues: [], refunds: [],
  }
  const fakeNotion = (load: () => Promise<InflowData>) => {
    const writes = vi.fn()
    const repo: Repo = {
      kind: 'notion', load,
      saveRecord: async (r) => { writes('saveRecord'); return r }, deleteRecord: async () => { writes('deleteRecord') },
      saveCost: async (c) => { writes('saveCost'); return c }, deleteCost: async () => { writes('deleteCost') },
      saveEntity: async (_k, e) => { writes('saveEntity'); return e }, deleteEntity: async () => { writes('deleteEntity') },
      saveRefund: async (f) => { writes('saveRefund'); return f }, deleteRefund: async () => { writes('deleteRefund') },
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
    for (const t of ['Review', 'Clients & work', 'Venue deals', 'Profit', 'P&L', 'Cash flow', 'Tax', 'Print']) expect(tabs).toContain(t)
    // Breakdown and its filter bar are folded into Clients & work.
    expect(tabs).not.toContain('Breakdown')
    expect(screen.queryByRole('button', { name: /Filter/ })).toBeNull()
  })

  it('the guide offers printable reports and foreign currencies, each switchable there', async () => {
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await screen.findByText('Welcome to InFlow')
    while (!screen.queryByText('Print it, in any currency')) await user.click(screen.getByRole('button', { name: 'Next', exact: true } as never))
    const printable = screen.getByRole('checkbox', { name: 'Printable reports' }) as HTMLInputElement
    const currencies = screen.getByRole('checkbox', { name: 'Foreign currencies' }) as HTMLInputElement
    expect([printable.checked, currencies.checked]).toEqual([true, false])
    await user.click(currencies)
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!).features.currencies).toBe(true)
  })

  it('a new user starts simple, is told so, and can turn everything on at once', async () => {
    // Nothing stored: a first visit. The tour is closed so the Overview shows.
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await user.click(await screen.findByRole('button', { name: 'Skip' }))
    const notice = await screen.findByLabelText('Simple start')
    expect(within(notice).getByText(/Expected payments, costs, tax, venue deals/)).toBeTruthy()
    // The quick start: income, insights and printable reports, nothing else.
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!).features).toEqual({ tax: false, costs: false, deals: false, insights: true, expected: false, currencies: false, printable: true, refunds: false, import: false })
    expect(await reportTabs()).toContain('Print')
    expect(screen.queryByRole('link', { name: /Costs/ })).toBeNull()
    expect(await reportTabs()).not.toContain('Venue deals')
    await go('#/overview')
    await user.click(within(screen.getByLabelText('Simple start')).getByRole('button', { name: 'Turn everything on' }))
    expect(screen.queryByLabelText('Simple start')).toBeNull()
    expect(screen.getByRole('link', { name: /Costs/ })).toBeTruthy()
    // The master switch turns them all off, and back to simple.
    await go('#/settings')
    await user.click(screen.getByRole('checkbox', { name: /^Everything/ }))
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!).features).toEqual({ tax: false, costs: false, deals: false, insights: false, expected: false, currencies: false, printable: false, refunds: false, import: false })
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
    expect(within(await screen.findByRole('dialog')).queryByLabelText(/People per session/)).toBeNull()
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
    expect(await reportTabs()).not.toContain('Tax')
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

describe('Import from Revolut (Release 2, experimental)', () => {
  const CSV = [
    'Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance',
    'TRANSFER,Current,2026-11-02 09:15:01,2026-11-02 09:15:44,Payment from Northwind SRL,1200.00,0.00,RON,COMPLETED,5200.00',
    'CARD_PAYMENT,Current,2026-11-04 12:00:00,2026-11-05 08:00:00,"Zoom, Inc.",-75.50,0.00,RON,COMPLETED,5124.50',
    'CARD_PAYMENT,Current,2026-11-06 12:00:00,2026-11-06 12:00:00,Corner Bakery,-18.00,0.00,RON,COMPLETED,5106.50',
    'TRANSFER,Current,2026-11-07 10:00:00,,To Ion Ionescu,-300.00,1.50,RON,PENDING,4806.50',
    'broken,row',
  ].join('\n')
  const mine: InflowData = { records: [], costs: [], clients: [], sources: [], venues: [], refunds: [] }

  it('is off by default, never switched on by "Everything", and labelled experimental', async () => {
    settings()
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await go('#/settings')
    const toggle = await screen.findByRole('checkbox', { name: /Import from Revolut \(experimental\)/ })
    expect((toggle as HTMLInputElement).checked).toBe(false)
    await user.click(screen.getByRole('checkbox', { name: /^Everything/ }))
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY)!).features.import).toBe(false)
    await go('#/import')
    expect(screen.queryByText('Import from Revolut', { selector: 'h2' })).toBeNull()
  })

  it('reads a file, shows what it found, imports what you decide, and undoes it', async () => {
    settings({ workspace: 'mine', demoSeeded: true, features: { ...ALL_FEATURES, import: true } })
    await store.set('data', mine)
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await go('#/income')
    await user.click(await screen.findByRole('link', { name: 'Import from Revolut' }))
    expect(await screen.findByText(/Experimental\./)).toBeTruthy()
    const file = new File([CSV], 'statement.csv', { type: 'text/csv' })
    await user.upload(screen.getByLabelText('Statement file'), file)
    // Summary first; nothing imported.
    expect(await screen.findByText('statement.csv')).toBeTruthy()
    expect(screen.getByText(/1 row was not read/)).toBeTruthy()
    expect(screen.getByText(/Line 6:/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Review transactions' }))
    // Bakery: personal. Zoom: business cost, in bulk.
    await user.click(screen.getByRole('checkbox', { name: /Select Zoom/ }))
    await user.click(screen.getByRole('button', { name: 'Business cost' }))
    // Money in from a name that is no client is never taken for income on its own: said here.
    await user.click(screen.getByRole('checkbox', { name: /Select Northwind/ }))
    await user.click(screen.getByRole('button', { name: 'Income' }))
    await user.click(screen.getByRole('button', { name: /Corner Bakery/ }))
    const dialog = await screen.findByRole('dialog')
    await user.selectOptions(within(dialog).getByLabelText('This is'), 'personal')
    await user.click(within(dialog).getByLabelText(/Next time, treat “Corner Bakery” the same way/))
    await user.click(within(dialog).getByRole('button', { name: 'Done' }))
    await user.click(screen.getByRole('button', { name: /^Continue: 3 ready/ }))
    expect(await screen.findByText(/1 new payment: 1,200(\.00)? lei income/)).toBeTruthy()
    expect(screen.getByText(/1 new cost: 75\.50? lei/)).toBeTruthy()
    expect(screen.getByText(/1 pending, declined or reversed: never imported/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Import' }))
    expect(await screen.findByText('Imported')).toBeTruthy()
    await waitFor(async () => {
      const d = (await store.get('data')) as InflowData
      expect(d.records.map((r) => r.amount)).toEqual([1200])
      expect(d.costs.map((c) => c.amount)).toEqual([75.5])
    })
    // The rule was kept; the history lists the import.
    const im = (await store.get('import:device')) as { rules: { value: string; kind: string }[]; batches: unknown[] }
    expect(im.rules).toEqual([expect.objectContaining({ value: 'Corner Bakery', kind: 'personal' })])
    // Undo, after confirming what it does.
    await user.click(screen.getByRole('button', { name: /Undo this import/ }))
    const confirm = await screen.findByRole('dialog')
    expect(within(confirm).getByText(/2 entries it added will be deleted/)).toBeTruthy()
    await user.click(within(confirm).getByRole('button', { name: 'Undo import' }))
    await waitFor(async () => {
      const d = (await store.get('data')) as InflowData
      expect([d.records.length, d.costs.length]).toEqual([0, 0])
    })
    expect(await screen.findByText('Import undone')).toBeTruthy()
  })

  it('an unfamiliar file is never read on a guess: it asks which column is which, then reads as told', async () => {
    settings({ workspace: 'mine', demoSeeded: true, features: { ...ALL_FEATURES, import: true } })
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await go('#/import')
    const csv = 'When,What,How much,Ccy\n2026-04-01,Payment from Ana Ilie,300.00,RON\n'
    await user.upload(await screen.findByLabelText('Statement file'), new File([csv], 'export.csv', { type: 'text/csv' }))
    expect(await screen.findByText(/can't tell for certain what this file's columns are/)).toBeTruthy()
    expect(screen.getByText(/Not recognised: When, What, How much, Ccy/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Review transactions' })).toBeNull()
    await user.selectOptions(screen.getByLabelText('Date'), 'When')
    await user.selectOptions(screen.getByLabelText('Amount (signed: money out negative)'), 'How much')
    await user.selectOptions(screen.getByLabelText('Currency'), 'Ccy')
    await user.selectOptions(screen.getByLabelText('Description'), 'What')
    await user.click(screen.getByRole('button', { name: 'Read with these columns' }))
    // No state column: whether its rows all went through is asked, not assumed.
    await user.click(await screen.findByRole('button', { name: 'Every row is completed' }))
    expect(await screen.findByRole('button', { name: 'Review transactions' })).toBeTruthy()
    expect(screen.getByText(/Read with the columns you chose/)).toBeTruthy()
  })

  it('a statement in a language InFlow has no words for: suggested columns, asked states, remembered next time', async () => {
    settings({ workspace: 'mine', demoSeeded: true, features: { ...ALL_FEATURES, import: true } })
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await go('#/import')
    const csv = 'Typ;Datum;Beskrivning;Belopp;Valuta;Status\nKortbetalning;2026-09-02;Café Kanel;-45,00;SEK;SLUTFÖRD\nÖverföring;2026-09-01;Betalning från Nordljus AB;1 200,00;SEK;SLUTFÖRD\n'
    const upload = async () => user.upload(await screen.findByLabelText('Statement file'), new File([csv], 'kontoutdrag.csv', { type: 'text/csv' }))
    await upload()
    // Belopp is not a word InFlow knows: suggested from the content, to check, never applied alone.
    const amount = await screen.findByLabelText('Amount (signed: money out negative)') as HTMLSelectElement
    expect(amount.selectedOptions[0].textContent).toBe('Belopp')
    expect(screen.getAllByText(/Suggested from what the column holds/).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Review transactions' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Read with these columns' }))
    await user.selectOptions(await screen.findByLabelText('State “SLUTFÖRD” means'), 'COMPLETED')
    await user.click(screen.getByRole('button', { name: 'Read with these answers' }))
    expect(await screen.findByRole('button', { name: 'Review transactions' })).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
    // The next export of the same layout reads at once, and says why.
    await upload()
    expect(await screen.findByText(/Read the way you set it up for files like this/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Review transactions' })).toBeTruthy()
  })

  it('asks the date order when the file can\'t show it', async () => {
    settings({ workspace: 'mine', demoSeeded: true, features: { ...ALL_FEATURES, import: true } })
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await go('#/import')
    const csv = 'Date,Description,Amount,Currency\n03/04/2026,Payment from Ana Ilie,300.00,RON\n'
    await user.upload(await screen.findByLabelText('Statement file'), new File([csv], 'export.csv', { type: 'text/csv' }))
    await user.selectOptions(await screen.findByLabelText('Dates in this file are written'), 'mdy')
    await user.click(await screen.findByRole('button', { name: 'Every row is completed' }))
    expect(await screen.findByRole('button', { name: 'Review transactions' })).toBeTruthy()
  })
})

describe('the manual', () => {
  it('opens from the book in the header, beside the data tag, and jumps to each part', async () => {
    settings()
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    const book = screen.getByRole('link', { name: 'The InFlow manual' })
    const tag = screen.getByRole('link', { name: 'Demo' })
    expect(book.compareDocumentPosition(tag) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await user.click(book)
    expect(await screen.findByRole('heading', { name: 'The InFlow manual' })).toBeTruthy()
    const contents = screen.getByRole('navigation', { name: 'Contents' })
    const parts = ['Start here', 'Set up your practice', 'Three kinds of money', 'Always on: income, insights, print', 'Sessions, packages, retainers', 'A simple routine', 'Switch on what you need', 'Rooms and venues', 'Costs and profit', 'Tax', 'What the reports tell you', 'Your data', 'Words used']
    expect(within(contents).getAllByRole('button')).toHaveLength(parts.length)
    for (const part of parts) {
      expect(screen.getByRole('heading', { name: part, level: 2 })).toBeTruthy()
    }
    expect(screen.queryByText(/You're exploring a demo practice/)).toBeNull()
  })
})
