/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react'
import { App } from './App'

// vi.mock factories are hoisted above imports/top-level consts, so the fixture
// data has to live inside vi.hoisted rather than a plain top-level const.
const { games } = vi.hoisted(() => ({
  games: [
    {
      id: '1', title: 'Monkey Island', year: 1990, developer: 'LucasArts',
      status: 'Completed', tags: ['Comedy'], journal: '', isDiscounted: false
    },
    {
      id: '2', title: 'The Last Express', year: 1997, developer: 'Smoking Car',
      status: 'Backlog', tags: ['Mystery'], journal: '', isDiscounted: true, discountPercent: 0.8, price: 1.39
    }
  ]
}))

vi.mock('./lib/mcp-connector', () => ({
  McpConnector: {
    isInitialized: () => true,
    getGames: vi.fn().mockResolvedValue(games),
    addGame: vi.fn(),
    updateGame: vi.fn(),
    updateGameStatus: vi.fn().mockResolvedValue(undefined),
    deleteGame: vi.fn().mockResolvedValue(undefined)
  }
}))

window.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe('App', () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    document.body.innerHTML = ''
    // App reads/writes discount-snooze and price-tracking state via localStorage;
    // clear it so tests don't leak state into each other.
    localStorage.clear()
  })

  it('renders games correctly', async () => {
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Monkey Island')).toBeTruthy()
    })
  })

  it('filters the timeline by search query', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByText('Monkey Island')).toBeTruthy())

    fireEvent.change(screen.getByPlaceholderText('SEARCH...'), { target: { value: 'Last Express' } })

    await waitFor(() => {
      expect(screen.getByText('The Last Express')).toBeTruthy()
      expect(screen.queryByText('Monkey Island')).toBeNull()
    })
  })

  it('filters the timeline by status chip', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByText('Monkey Island')).toBeTruthy())

    fireEvent.click(screen.getByText('[BACKLOG]'))

    await waitFor(() => {
      expect(screen.getByText('The Last Express')).toBeTruthy()
      expect(screen.queryByText('Monkey Island')).toBeNull()
    })
  })

  it('shows the discount banner and opens the discount modal for on-sale games', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByText('Monkey Island')).toBeTruthy())

    expect(screen.getByText(/GAME ON SALE/)).toBeTruthy()
    fireEvent.click(screen.getByText(/GAME ON SALE/))

    await waitFor(() => {
      expect(screen.getByText('ACTIVE_DISCOUNT')).toBeTruthy()
    })
  })

  it('hides the discount banner for 24h after it is dismissed', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByText(/GAME ON SALE/)).toBeTruthy())

    fireEvent.click(screen.getByLabelText('Dismiss for 24 hours'))
    expect(screen.queryByText(/GAME ON SALE/)).toBeNull()

    cleanup()
    render(<App />)
    await waitFor(() => expect(screen.getByText('Monkey Island')).toBeTruthy())
    expect(screen.queryByText(/GAME ON SALE/)).toBeNull()
  })

  it('toasts a price drop detected against the previously seen price', async () => {
    localStorage.setItem('cd_last_prices', JSON.stringify({ '2': 99.99 }))
    render(<App />)

    await waitFor(() => {
      expect(screen.getByText(/PRICE DROP/)).toBeTruthy()
    })
  })

  it('broadens search to match tags and journal text, not just title/developer', async () => {
    render(<App />)
    await waitFor(() => expect(screen.getByText('Monkey Island')).toBeTruthy())

    fireEvent.change(screen.getByPlaceholderText('SEARCH...'), { target: { value: 'mystery' } })
    await waitFor(() => {
      expect(screen.getByText('The Last Express')).toBeTruthy()
      expect(screen.queryByText('Monkey Island')).toBeNull()
    })
  })

  it('shows a distinct sync-error banner (not an empty state) when getGames fails', async () => {
    const { McpConnector } = await import('./lib/mcp-connector')
    McpConnector.getGames.mockRejectedValueOnce(new Error('Invalid token'))

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText(/SYNC FAILED: Invalid token/)).toBeTruthy()
    })
    expect(screen.queryByText(/RECORDS FOUND/)).toBeNull()
  })

  it('updates status optimistically without a full games re-fetch', async () => {
    const { McpConnector } = await import('./lib/mcp-connector')
    render(<App />)
    await waitFor(() => expect(screen.getByText('Monkey Island')).toBeTruthy())

    const callsBefore = McpConnector.getGames.mock.calls.length
    fireEvent.click(screen.getByLabelText('Rate 3 stars'))

    await waitFor(() => {
      // 4th arg (completedAt) is undefined — this fixture predates the R2
      // schema patch (no `completedAt` key at all), so handleUpdateStatus
      // must leave it untouched rather than writing anything.
      expect(McpConnector.updateGameStatus).toHaveBeenCalledWith('1', 'Completed', 3, undefined)
    })
    // No additional getGames() call — the UI updates from local state, not a re-fetch.
    expect(McpConnector.getGames.mock.calls.length).toBe(callsBefore)
  })

  describe('Completed At auto-stamping (R2)', () => {
    const schemaGames = [
      {
        id: '1', title: 'Monkey Island', year: 1990, developer: 'LucasArts',
        status: 'Backlog', tags: ['Comedy'], journal: '', isDiscounted: false, rating: null, completedAt: null
      },
      {
        id: '2', title: 'The Last Express', year: 1997, developer: 'Smoking Car',
        status: 'Completed', tags: ['Mystery'], journal: '', isDiscounted: false, rating: null, completedAt: '2026-01-01'
      }
    ]

    it('stamps completedAt = today on an observed non-Completed -> Completed transition', async () => {
      const { McpConnector } = await import('./lib/mcp-connector')
      McpConnector.getGames.mockResolvedValueOnce(schemaGames)
      render(<App />)
      await waitFor(() => expect(screen.getByText('Monkey Island')).toBeTruthy())

      // Monkey Island starts Backlog — cycle it to Completed via its own
      // quick-update row (scoped so it doesn't hit Last Express's).
      const card = screen.getByText('Monkey Island').closest('.cd-game-card')
      fireEvent.click(within(card).getByText('Completed'))

      const today = new Date().toISOString().slice(0, 10)
      await waitFor(() => {
        expect(McpConnector.updateGameStatus).toHaveBeenCalledWith('1', 'Completed', null, today)
      })
    })

    it('clears completedAt on an observed Completed -> non-Completed transition', async () => {
      const { McpConnector } = await import('./lib/mcp-connector')
      McpConnector.getGames.mockResolvedValueOnce(schemaGames)
      render(<App />)
      await waitFor(() => expect(screen.getByText('The Last Express')).toBeTruthy())

      // Cycle the already-Completed card's status back to Backlog via its
      // own quick-update row (scoped so it doesn't hit Monkey Island's).
      const card = screen.getByText('The Last Express').closest('.cd-game-card')
      fireEvent.click(within(card).getByText('Backlog'))

      await waitFor(() => {
        expect(McpConnector.updateGameStatus).toHaveBeenCalledWith('2', 'Backlog', null, null)
      })
    })
  })

  it('rolls back an optimistic status update and toasts on failure', async () => {
    const { McpConnector } = await import('./lib/mcp-connector')
    McpConnector.updateGameStatus.mockRejectedValueOnce(new Error('network down'))
    render(<App />)
    await waitFor(() => expect(screen.getByText('Monkey Island')).toBeTruthy())

    fireEvent.click(screen.getByLabelText('Rate 3 stars'))

    await waitFor(() => {
      expect(screen.getByText(/UPDATE FAILED/)).toBeTruthy()
    })
  })

  describe('discount banner persistence', () => {
    it('hides the dismiss button and ignores the snooze when persistent mode is on', async () => {
      localStorage.setItem('cd_discount_banner_persistent', 'true')
      localStorage.setItem('cd_discount_snooze_until', String(Date.now() + 1000 * 60 * 60))
      render(<App />)

      await waitFor(() => expect(screen.getByText(/GAME ON SALE/)).toBeTruthy())
      expect(screen.queryByLabelText('Dismiss for 24 hours')).toBeNull()
    })
  })

  describe('sort/status filter persistence', () => {
    it('restores a previously-saved sort mode and status filter on load instead of resetting to defaults', async () => {
      localStorage.setItem('cd_sort_by', 'alpha')
      localStorage.setItem('cd_status_filter', 'Backlog')
      render(<App />)

      await waitFor(() => expect(screen.getByText('Alphabetical')).toBeTruthy())
      expect(screen.getByText('[BACKLOG]').closest('button').className).toContain('active')
    })

    it('falls back to defaults when localStorage holds a value outside the known option set', async () => {
      localStorage.setItem('cd_sort_by', 'not-a-real-mode')
      localStorage.setItem('cd_status_filter', 'not-a-real-status')
      render(<App />)

      await waitFor(() => expect(screen.getByText('Timeline')).toBeTruthy())
      expect(screen.getByText('[ALL]').closest('button').className).toContain('active')
    })

    it('persists a sort change so it survives a reload', async () => {
      render(<App />)
      await waitFor(() => expect(screen.getByText('Monkey Island')).toBeTruthy())

      fireEvent.click(screen.getByText('Timeline'))
      fireEvent.click(screen.getByText('Highest Rated'))

      expect(localStorage.getItem('cd_sort_by')).toBe('rating')
    })

    it('persists a status filter change so it survives a reload', async () => {
      render(<App />)
      await waitFor(() => expect(screen.getByText('Monkey Island')).toBeTruthy())

      fireEvent.click(screen.getByText('[BACKLOG]'))

      expect(localStorage.getItem('cd_status_filter')).toBe('Backlog')
    })
  })

  describe('sort menu keyboard navigation', () => {
    it('opens the menu and moves focus through the options with arrow keys', async () => {
      render(<App />)
      await waitFor(() => expect(screen.getByText('Monkey Island')).toBeTruthy())

      const trigger = screen.getByText('Timeline').closest('button')
      trigger.focus()
      fireEvent.keyDown(trigger, { key: 'ArrowDown' })

      await waitFor(() => {
        expect(document.activeElement.textContent).toBe('Timeline')
        expect(document.activeElement.className).toContain('cd-sort-option')
      })

      fireEvent.keyDown(document.activeElement, { key: 'ArrowDown' })
      expect(document.activeElement.textContent).toBe('Recently Added')

      // Wraps from the last option back to the first.
      fireEvent.keyDown(document.activeElement, { key: 'End' })
      expect(document.activeElement.textContent).toBe('Alphabetical')
      fireEvent.keyDown(document.activeElement, { key: 'ArrowDown' })
      expect(document.activeElement.textContent).toBe('Timeline')
    })

    it('selects the focused option on Enter and returns focus to the trigger', async () => {
      render(<App />)
      await waitFor(() => expect(screen.getByText('Monkey Island')).toBeTruthy())

      const trigger = screen.getByText('Timeline').closest('button')
      trigger.focus()
      fireEvent.keyDown(trigger, { key: 'ArrowDown' })
      await waitFor(() => expect(document.activeElement.className).toContain('cd-sort-option'))

      fireEvent.keyDown(document.activeElement, { key: 'ArrowDown' })
      expect(document.activeElement.textContent).toBe('Recently Added')
      fireEvent.click(document.activeElement)

      await waitFor(() => {
        expect(screen.getByText('Recently Added')).toBeTruthy()
        expect(document.activeElement).toBe(trigger)
      })
    })

    it('closes the menu and returns focus to the trigger on Escape', async () => {
      render(<App />)
      await waitFor(() => expect(screen.getByText('Monkey Island')).toBeTruthy())

      const trigger = screen.getByText('Timeline').closest('button')
      trigger.focus()
      fireEvent.keyDown(trigger, { key: 'ArrowDown' })
      await waitFor(() => expect(document.activeElement.className).toContain('cd-sort-option'))

      fireEvent.keyDown(document.activeElement, { key: 'Escape' })

      await waitFor(() => {
        expect(document.querySelector('.cd-sort-menu')).toBeNull()
        expect(document.activeElement).toBe(trigger)
      })
    })
  })

  describe('Ignored games are excluded from every normal view', () => {
    const ignoredGame = {
      id: '3', title: 'Skipped Title', year: 2027, developer: 'Some Studio',
      status: 'Backlog', tags: [], journal: '', releaseStatus: 'Ignored'
    }

    it('never appears on the Timeline, even under [ALL]', async () => {
      const { McpConnector } = await import('./lib/mcp-connector')
      McpConnector.getGames.mockResolvedValueOnce([...games, ignoredGame])
      render(<App />)
      await waitFor(() => expect(screen.getByText('Monkey Island')).toBeTruthy())
      expect(screen.queryByText('Skipped Title')).toBeNull()
    })

    it('never appears in Analytics, regardless of its RELEASE filter', async () => {
      const { McpConnector } = await import('./lib/mcp-connector')
      McpConnector.getGames.mockResolvedValueOnce([...games, ignoredGame])
      render(<App />)
      await waitFor(() => expect(screen.getByText('Monkey Island')).toBeTruthy())
      fireEvent.click(screen.getByLabelText('Analytics view'))
      await waitFor(() => expect(screen.getByText('TAG_MATRIX')).toBeTruthy())
      expect(screen.queryByText('Skipped Title')).toBeNull()
    })

    it('is not counted in Stats\' TOTAL ENTRIES', async () => {
      const { McpConnector } = await import('./lib/mcp-connector')
      McpConnector.getGames.mockResolvedValueOnce([...games, ignoredGame])
      render(<App />)
      await waitFor(() => expect(screen.getByText('Monkey Island')).toBeTruthy())
      fireEvent.click(screen.getByLabelText('Stats view'))
      await waitFor(() => expect(screen.getByText('TOTAL ENTRIES')).toBeTruthy())
      // Only the 2 active-collection games count, not the 3rd (Ignored) one.
      expect(screen.getByText('TOTAL ENTRIES').closest('.cd-stat-box').textContent).toContain('2')
    })

    it('still shows up on [W], in its own IGNORED section', async () => {
      const { McpConnector } = await import('./lib/mcp-connector')
      McpConnector.getGames.mockResolvedValueOnce([...games, ignoredGame])
      render(<App />)
      await waitFor(() => expect(screen.getByText('Monkey Island')).toBeTruthy())
      fireEvent.click(screen.getByLabelText('Watchlist view'))
      await waitFor(() => expect(screen.getByText('[+] IGNORED (1)')).toBeTruthy())
      fireEvent.click(screen.getByText('[+] IGNORED (1)'))
      expect(screen.getByText('Skipped Title')).toBeTruthy()
    })
  })
})
