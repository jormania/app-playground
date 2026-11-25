// @vitest-environment jsdom
// The whole app on an in-memory store with the demo seeded, driven the way a
// person would: the tour, the dashboard, adding a payment, tax switched off,
// the printable report, clearing the demo.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { memoryStore, type KeyValueStore } from '../shared/kvStore'
import App from './App'
import { SETTINGS_KEY } from './store/settings'

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
    expect(screen.getByText(/Taxable or not/)).toBeTruthy()
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
    const saved = (await store.get<{ records: { amount: number; clientId: string; classification: string; taxReserve: number | null }[] }>('data'))!
    const mine = saved.records.find((r) => r.amount === 750 && r.clientId === 'demo_c_andreea')!
    expect(mine.classification).toBe('suggested')
    expect(mine.taxReserve).toBeGreaterThan(0)
  })

  it('with tax switched off shows only the money flow', async () => {
    settings({ trackTax: false })
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    expect(screen.queryByText(/Taxable or not/)).toBeNull()
    expect(screen.getByText('Regular or one-off')).toBeTruthy()
    await go('#/reports')
    expect(screen.queryByRole('radio', { name: 'Tax*' })).toBeNull()
  })

  it('builds a printable report that follows its options', async () => {
    settings()
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    await go('#/reports/print')
    const frame = await screen.findByTitle('Report preview') as HTMLIFrameElement
    expect(frame.getAttribute('srcdoc')).toContain('By venue')
    await user.click(screen.getByLabelText('By venue'))
    expect(frame.getAttribute('srcdoc')).not.toContain('By venue')
  })

  it('clears the demo data and keeps a payment the user added', async () => {
    settings()
    const user = userEvent.setup()
    render(<App store={store} today={today} />)
    await screen.findByTestId('period-total')
    const data = (await store.get<{ records: { id: string; demo?: boolean }[] }>('data'))!
    await store.set('data', { ...data, records: [...data.records, { ...data.records[0], id: 'loc_mine', demo: undefined, description: 'Mine' }] })
    await go('#/settings')
    // Reload so the provider reads the record added behind its back.
    cleanup()
    render(<App store={store} today={today} />)
    await go('#/settings')
    await user.click(await screen.findByRole('button', { name: 'Clear demo data' }))
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Clear' }))
    await waitFor(async () => {
      const after = (await store.get<{ records: { id: string }[] }>('data'))!
      expect(after.records.map((r) => r.id)).toEqual(['loc_mine'])
    })
  })
})
