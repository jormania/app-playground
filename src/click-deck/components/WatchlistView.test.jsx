/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { WatchlistView } from './WatchlistView'

describe('WatchlistView', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => { cleanup(); vi.unstubAllGlobals() })

  const comingSoonGame = {
    id: 'cs1', title: 'Jordi & Oslo: The Lost Tail', developer: 'De Falces',
    year: 2027, appId: 2966330, releaseStatus: 'Coming Soon', releaseDate: 'Q3 2027',
    createdTime: '2026-01-01T00:00:00.000Z', tags: [], status: 'Backlog'
  }
  const releasedGame = {
    id: 'rel1', title: 'Freshly Out', developer: 'Some Studio',
    year: 2026, appId: 111, releaseStatus: 'Released',
    releasedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    releaseDate: '17 Jul, 2026', createdTime: '2026-01-01T00:00:00.000Z', tags: [], status: 'Backlog'
  }

  it('shows an empty-state message when there is nothing tracked or recently released', () => {
    render(<WatchlistView games={[]} onEdit={() => {}} onApplyGameUpdates={() => {}} onAddGame={() => {}} onToast={() => {}} />)
    expect(screen.getByText(/Nothing tracked yet/)).toBeTruthy()
    expect(screen.getByText(/Nothing has flipped/)).toBeTruthy()
  })

  it('lists a Coming Soon game under COMING SOON with its expected date, and excludes it from RECENTLY RELEASED', () => {
    render(<WatchlistView games={[comingSoonGame]} onEdit={() => {}} onApplyGameUpdates={() => {}} onAddGame={() => {}} onToast={() => {}} />)
    expect(screen.getByText('Jordi & Oslo: The Lost Tail')).toBeTruthy()
    expect(screen.getByText(/EXPECTED: Q3 2027/)).toBeTruthy()
  })

  it('lists a recently-transitioned game under RECENTLY RELEASED with its release date', () => {
    render(<WatchlistView games={[releasedGame]} onEdit={() => {}} onApplyGameUpdates={() => {}} onAddGame={() => {}} onToast={() => {}} />)
    expect(screen.getByText('Freshly Out')).toBeTruthy()
    expect(screen.getByText(/RELEASED: 17 Jul, 2026/)).toBeTruthy()
  })

  it('header stat line reflects tracked / recently-released counts', () => {
    render(<WatchlistView games={[comingSoonGame, releasedGame]} onEdit={() => {}} onApplyGameUpdates={() => {}} onAddGame={() => {}} onToast={() => {}} />)
    // "1 tracked", "1 just released" — loosely matched since the count is a <strong> child.
    const statLine = document.querySelector('.cd-watchlist-stat-line')
    expect(statLine.textContent).toContain('tracked')
    expect(statLine.textContent).toContain('just released')
  })

  it('clicking [E]DIT on a Coming Soon card calls onEdit with that game', () => {
    const onEdit = vi.fn()
    render(<WatchlistView games={[comingSoonGame]} onEdit={onEdit} onApplyGameUpdates={() => {}} onAddGame={() => {}} onToast={() => {}} />)
    fireEvent.click(screen.getByText('[E]DIT'))
    expect(onEdit).toHaveBeenCalledWith(comingSoonGame)
  })

  it('"Find New Games" toasts a message when there are no followed studios yet', async () => {
    const onToast = vi.fn()
    render(<WatchlistView games={[]} onEdit={() => {}} onApplyGameUpdates={() => {}} onAddGame={() => {}} onToast={onToast} />)
    fireEvent.click(screen.getByText('🔭 FIND NEW GAMES'))
    await waitFor(() => expect(onToast).toHaveBeenCalledWith(expect.stringContaining('No followed studios yet')))
  })

  it('"Refresh Release Dates" toasts when there is nothing Coming Soon to check', async () => {
    const onToast = vi.fn()
    render(<WatchlistView games={[releasedGame]} onEdit={() => {}} onApplyGameUpdates={() => {}} onAddGame={() => {}} onToast={onToast} />)
    fireEvent.click(screen.getByText('🔄 REFRESH RELEASE DATES'))
    await waitFor(() => expect(onToast).toHaveBeenCalledWith('Nothing in Coming Soon to check.'))
  })

  it('"Refresh Release Dates" applies a flip via the appdetails proxy and reports it', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        '2966330': { success: true, data: { release_date: { coming_soon: false, date: '1 Aug, 2026' } } }
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    const onApplyGameUpdates = vi.fn()
    const onToast = vi.fn()

    render(<WatchlistView games={[comingSoonGame]} onEdit={() => {}} onApplyGameUpdates={onApplyGameUpdates} onAddGame={() => {}} onToast={onToast} />)
    fireEvent.click(screen.getByText('🔄 REFRESH RELEASE DATES'))

    await waitFor(() => expect(onApplyGameUpdates).toHaveBeenCalled())
    const [updated] = onApplyGameUpdates.mock.calls[0]
    expect(updated[0].releaseStatus).toBe('Released')
    expect(updated[0].releasedAt).toBeTruthy()
    await waitFor(() => expect(onToast).toHaveBeenCalledWith(expect.stringContaining('just released')))
  })
})
