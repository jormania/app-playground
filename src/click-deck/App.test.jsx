/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
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
      status: 'Backlog', tags: ['Mystery'], journal: '', isDiscounted: true, discountPercent: 0.8
    }
  ]
}))

vi.mock('./lib/mcp-connector', () => ({
  McpConnector: {
    isInitialized: () => true,
    getGames: vi.fn().mockResolvedValue(games),
    addGame: vi.fn(),
    updateGame: vi.fn(),
    updateGameStatus: vi.fn()
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
    fireEvent.click(screen.getByText(/GAME ON SALE/).closest('.cd-discount-banner'))

    await waitFor(() => {
      expect(screen.getByText('ACTIVE_DISCOUNT')).toBeTruthy()
    })
  })
})
