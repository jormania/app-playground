// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MonthlyPair, MoversChart, TrendChart } from './charts'

afterEach(cleanup)

const days = ['2026-11-23', '2026-11-24', '2026-11-25'].map((d, i) => ({ from: d, to: d, label: ['Mon', 'Tue', 'Wed'][i] }))

describe('the trend chart\'s readout', () => {
  it('shows the whole period first, each figure labelled, with room of its own', () => {
    render(<TrendChart buckets={days} current={[611, 0, 200]} previous={[0, 150, 0]} previousLabel="last week" />)
    expect(screen.getByText('Whole period')).toBeTruthy()
    expect(screen.getByText('So far')).toBeTruthy()
    expect(screen.getByText(/^811/)).toBeTruthy()
    expect(screen.getAllByText('Last week')).toHaveLength(2) // the legend, and the figure's label
    expect(screen.getByText(/^150/)).toBeTruthy()
    expect(screen.getByText('Tap a bar for one day')).toBeTruthy()
  })

  it('a tapped day reads as a date, beside the same day of the period before, with the change', async () => {
    const user = userEvent.setup()
    const { container } = render(<TrendChart buckets={days} current={[611, 0, 200]} previous={[0, 150, 0]} previousLabel="last week" />)
    const bars = container.querySelectorAll('g[class]')
    await user.click(bars[1])
    expect(screen.getByText('Tue 24 Nov')).toBeTruthy()
    expect(screen.getAllByText('Last week')).toHaveLength(2)
    expect(screen.getByText(/−150 lei/)).toBeTruthy()
    expect(screen.getByText(/on the same day, last week/)).toBeTruthy()
    await user.click(bars[0])
    expect(screen.getByText('Mon 23 Nov')).toBeTruthy()
    expect(screen.getByText('Nothing came in the same day, last week.')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Whole period' }))
    expect(screen.getByText('Whole period')).toBeTruthy()
    expect(screen.queryByText('2026-11-23')).toBeNull()
  })

  it('a week bar cut short at the month\'s edge is still a week', async () => {
    const user = userEvent.setup()
    const weeks = [{ from: '2026-11-01', to: '2026-11-01', label: '1 Nov' }, { from: '2026-11-02', to: '2026-11-08', label: '2 Nov' }]
    const { container } = render(<TrendChart buckets={weeks} current={[3324, 4000]} previous={[4787, 9000]} previousLabel="the month before" />)
    expect(screen.getByText('Tap a bar for one week')).toBeTruthy()
    await user.click(container.querySelectorAll('g[class]')[0])
    expect(screen.getByText('Week of 1 Nov')).toBeTruthy()
    expect(screen.getByText(/on the same week, the month before/)).toBeTruthy()
  })
})

describe('the income and costs chart\'s readout', () => {
  const months = [{ label: 'Oct', from: '2026-10-01' }, { label: 'Nov', from: '2026-11-01' }]
  it('shows the whole range, then one month, as three labelled figures', async () => {
    const user = userEvent.setup()
    const { container } = render(<MonthlyPair months={months} income={[5000, 2000]} costs={[1000, 2500]} />)
    expect(screen.getByText('October 2026 – November 2026')).toBeTruthy()
    expect(screen.getByText(/^7,000 lei/)).toBeTruthy()
    // 7,000 in, 3,500 out, 3,500 kept: costs and kept happen to be equal.
    expect(screen.getAllByText(/^3,500 lei/)).toHaveLength(2)
    await user.click(container.querySelectorAll('g[class]')[1])
    expect(screen.getByText('November 2026')).toBeTruthy()
    // 2,000 in, 2,500 out: 500 lei short, shown as a loss.
    const kept = screen.getByText('-500 lei')
    expect(kept.className).toMatch(/down/)
    await user.click(screen.getByRole('button', { name: 'All months' }))
    expect(screen.getByText('October 2026 – November 2026')).toBeTruthy()
  })
})

describe('main movers', () => {
  const rows = [
    { key: 'a', name: 'Mindful Leaders Collective Romania', tag: 'Client', change: -7000, current: 0, previous: 7000 },
    { key: 'b', name: 'Workshop', tag: 'Activity', change: -4800, current: 4900, previous: 9700 },
    { key: 'c', name: 'Studio Tulp', tag: 'Client', change: 2500, current: 4000, previous: 1500 },
  ]
  it('groups what fell and what rose, bigger first, each with its name in full, change, kind and before → now', () => {
    render(<MoversChart rows={rows} prevLabel="the month before" />)
    const groups = screen.getAllByRole('group')
    expect(groups.map((g) => g.getAttribute('aria-label'))).toEqual(['Fell', 'Rose'])
    expect(groups[0].textContent).toMatch(/^Fell.*Mindful Leaders Collective Romania.*−7k.*Client · 7k → 0.*Workshop.*−4.8k.*Activity · 9.7k → 4.9k/)
    expect(groups[1].textContent).toMatch(/Studio Tulp.*\+2.5k.*Client · 1.5k → 4k/)
  })
})

describe('a change under 1% is shown, not rounded away', () => {
  it('+50 lei on 13,887 reads +0.4%', async () => {
    const user = userEvent.setup()
    const weeks = [{ from: '2026-11-09', to: '2026-11-15', label: '9 Nov' }]
    const { container } = render(<TrendChart buckets={weeks} current={[13937]} previous={[13887]} previousLabel="the month before" />)
    await user.click(container.querySelectorAll('g[class]')[0])
    expect(screen.getByText(/\+50 lei \(\+0\.4%\)/)).toBeTruthy()
  })
})
