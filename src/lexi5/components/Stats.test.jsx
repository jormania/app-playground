// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react'
import { Stats } from './Stats'

// Mock ds components
vi.mock('../../ds', () => ({
  Modal: ({ children, open, title }) => (open ? <div data-testid="modal" aria-label={title}>{children}</div> : null),
  Button: ({ children, onClick, disabled }) => (
    <button data-testid="button" onClick={onClick} disabled={disabled}>{children}</button>
  ),
}))

describe('Stats component', () => {
  const defaultStats = {
    standard: {
      gamesPlayed: 10,
      gamesWon: 8,
      currentStreak: 2,
      maxStreak: 5,
      guesses: { 1: 0, 2: 1, 3: 2, 4: 3, 5: 1, 6: 1 },
    },
  }

  const defaultGameState = {
    date: 'Wed Aug 12 2026',
    iteration: 0,
    dictionary: 'standard',
    status: 'won',
    guesses: ['apple', 'berry', 'robot'],
    difficulty: 'normal',
  }

  const idleDefinition = { word: null, status: 'idle', text: null }

  const mockOnToast = vi.fn()
  const mockOnPlayAgain = vi.fn()
  const mockOnClose = vi.fn()
  const mockRequestDefinition = vi.fn()

  const renderStats = (props = {}) =>
    render(
      <Stats
        open
        onClose={mockOnClose}
        stats={defaultStats}
        gameState={defaultGameState}
        word="robot"
        onPlayAgain={mockOnPlayAgain}
        onToast={mockOnToast}
        highContrast={false}
        hintUsed={false}
        definition={idleDefinition}
        requestDefinition={mockRequestDefinition}
        {...props}
      />
    )

  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true })
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    })
  })

  afterEach(cleanup)

  it('requests the definition for a finished game on open', () => {
    // Whether that turns into an actual fetch is requestDefinition's call (it owns the
    // per-word cache, shared with the hint button) — Stats always asks on a fresh open,
    // covered end-to-end in App.hint.test.jsx.
    renderStats()
    expect(mockRequestDefinition).toHaveBeenCalledWith('robot')
  })

  it('shows the found definition', () => {
    renderStats({ definition: { word: 'robot', status: 'found', text: 'A humanoid machine.' } })
    expect(screen.getByText('A humanoid machine.')).toBeTruthy()
  })

  it('tells the truth when the API has no entry, distinct from a real failure', () => {
    renderStats({ definition: { word: 'robot', status: 'not-found', text: null } })
    expect(screen.getByText('No definition found for this word.')).toBeTruthy()
  })

  it('does not blame connectivity for a definition that simply failed to load', () => {
    renderStats({ definition: { word: 'robot', status: 'error', text: null } })
    expect(screen.getByText(/try again in a moment/)).toBeTruthy()
  })

  it('shows nothing while the definition is still in flight', () => {
    renderStats({ definition: { word: 'robot', status: 'loading', text: null } })
    expect(screen.queryByText(/No definition|try again|humanoid/)).toBeNull()
  })

  it('offers a single Share button — no separate Image/Grid/Stats variants', () => {
    renderStats()
    expect(screen.getByText('Share')).toBeTruthy()
    expect(screen.queryByText('Image')).toBeNull()
    expect(screen.queryByText('Grid')).toBeNull()
    expect(screen.queryByText('Stats')).toBeNull()
  })

  it('hides the Share button when there is no grid to share', () => {
    renderStats({ gameState: { ...defaultGameState, guesses: [] } })
    expect(screen.queryByText('Share')).toBeNull()
  })

  it('shares the same emoji-grid text the result bar sends, and toasts on copy', async () => {
    renderStats()
    fireEvent.click(screen.getByText('Share'))

    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalled()
    })
    const [shared] = navigator.clipboard.writeText.mock.calls[0]
    expect(shared).toContain('3/6')
    expect(shared.toLowerCase()).not.toContain('robot')
    expect(mockOnToast).toHaveBeenCalledWith('Result copied to clipboard!')
  })

  it('resets scroll when the dictionary picker changes', () => {
    // Regression: the word/definition/share footer only renders for the currently-played
    // dictionary, so switching away from it can shrink the panel a lot. Left at whatever
    // scroll offset the player was at, the panel could land past its new, shorter end.
    const scrollTo = vi.fn()
    const originalScrollTo = Element.prototype.scrollTo
    Element.prototype.scrollTo = scrollTo

    try {
      renderStats()
      scrollTo.mockClear() // drop the reset-on-open call, this test is about the picker

      fireEvent.change(screen.getByLabelText('Showing'), { target: { value: 'lite' } })
      expect(scrollTo).toHaveBeenCalledWith({ top: 0 })
    } finally {
      Element.prototype.scrollTo = originalScrollTo
    }
  })
})
