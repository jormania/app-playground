// @vitest-environment happy-dom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NurseryView } from './NurseryView'
import type { Thing } from '../lib/notion'
import { todayIso } from '../lib/understory'

afterEach(cleanup)

// Local calendar date, matching how the season is actually counted. Using
// `toISOString()` here made these tests pass in the evening and fail after
// local midnight — which is how the app's own UTC date stamps were found.
function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return todayIso(d)
}

function arrival(id: string, encounteredDaysAgo: number, over: Partial<Thing> = {}): Thing {
  return {
    id,
    handle: id,
    body: `body of ${id}`,
    kind: null,
    state: 'Understory',
    sourceId: null,
    locator: '',
    encountered: daysAgo(encounteredDaysAgo),
    kept: null,
    note: '',
    lociIds: [],
    image: null,
    link: null,
    koboBookmarkId: null,
    ...over,
  }
}

describe('NurseryView', () => {
  it('names what lives here and the act that fills it when empty', () => {
    render(<NurseryView things={[]} onKeep={vi.fn()} onRelease={vi.fn()} />)
    expect(screen.getByText(/nursery is empty/i)).toBeTruthy()
  })

  it('renders each arrival with Keep and Release', async () => {
    const user = userEvent.setup()
    const onKeep = vi.fn()
    const onRelease = vi.fn()
    render(<NurseryView things={[arrival('a', 1)]} onKeep={onKeep} onRelease={onRelease} />)

    await user.click(screen.getByRole('button', { name: 'Keep' }))
    expect(onKeep).toHaveBeenCalledWith('a')
    await user.click(screen.getByRole('button', { name: 'Release' }))
    expect(onRelease).toHaveBeenCalledWith('a')
  })

  // SILVA.md is explicit twice over: "No badge, no counter, no 'you have 284
  // items to process'", and the season is "shown as a fade rather than a
  // number." A countdown rendered into the row was a direct contradiction.
  it('shows the season as opacity, never as visible text', () => {
    render(<NurseryView things={[arrival('a', 45)]} onKeep={vi.fn()} onRelease={vi.fn()} seasonDays={90} />)
    const row = screen.getByRole('listitem')
    // Halfway through a 90-day season: 0.4 + 0.5 * 0.6 = 0.7
    expect(Number(row.style.opacity)).toBeCloseTo(0.7, 1)

    // No rendered text anywhere in the row states the count — the season is
    // carried by opacity plus the accessible name of a graphic bar.
    expect(row.textContent).not.toMatch(/\d+\s*days?/i)
    const bar = row.querySelector('[role="img"]')
    expect(bar).toBeTruthy()
    expect(bar!.getAttribute('aria-label')).toMatch(/\d+ days of this season left/i)
  })

  it('fades further as the season runs down', () => {
    const { rerender } = render(
      <NurseryView things={[arrival('a', 1)]} onKeep={vi.fn()} onRelease={vi.fn()} seasonDays={90} />,
    )
    const fresh = Number(screen.getByRole('listitem').style.opacity)
    rerender(<NurseryView things={[arrival('a', 85)]} onKeep={vi.fn()} onRelease={vi.fn()} seasonDays={90} />)
    expect(Number(screen.getByRole('listitem').style.opacity)).toBeLessThan(fresh)
  })

  // …but the fact itself is still available to anyone who can't perceive an
  // opacity. Withholding it from a screen reader would be an accessibility
  // bug wearing a design principle's clothes.
  it('still exposes the remaining season to assistive tech', () => {
    render(<NurseryView things={[arrival('a', 80)]} onKeep={vi.fn()} onRelease={vi.fn()} seasonDays={90} />)
    expect(screen.getByLabelText(/10 days of this season left/i)).toBeTruthy()
  })

  it('honours a shorter configured season', () => {
    render(<NurseryView things={[arrival('a', 20)]} onKeep={vi.fn()} onRelease={vi.fn()} seasonDays={30} />)
    expect(screen.getByLabelText(/10 days of this season left/i)).toBeTruthy()
  })

  it('never shows a negative season for something already past its date', () => {
    render(<NurseryView things={[arrival('a', 200)]} onKeep={vi.fn()} onRelease={vi.fn()} seasonDays={90} />)
    expect(screen.getByLabelText(/fading out of the nursery/i)).toBeTruthy()
  })
})
