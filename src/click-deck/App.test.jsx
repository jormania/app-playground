/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { App } from './App'

vi.mock('./lib/mcp-connector', () => ({
  McpConnector: {
    isInitialized: () => true,
    getGames: vi.fn().mockResolvedValue([
      {
        id: '1',
        title: 'Monkey Island',
        year: 1990,
        developer: 'LucasArts',
        status: 'Completed',
        tags: ['Comedy'],
        journal: ''
      }
    ]),
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
})
