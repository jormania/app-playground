// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react'
import { Stats } from './Stats'
import html2canvas from 'html2canvas'

// Mock html2canvas
vi.mock('html2canvas', () => ({
  default: vi.fn()
}))

// Mock ds components
vi.mock('../../ds', () => ({
  Modal: ({ children, open }) => (open ? <div data-testid="modal">{children}</div> : null),
  Button: ({ children, onClick, disabled }) => (
    <button data-testid="button" onClick={onClick} disabled={disabled}>{children}</button>
  ),
  SegmentedControl: ({ value, onChange }) => (
    <select data-testid="segmented-control" value={value} onChange={e => onChange(e.target.value)}>
      <option value="standard">Standard</option>
      <option value="lite">Lite</option>
    </select>
  )
}))

// Mock Chart.js to avoid canvas errors
vi.mock('react-chartjs-2', () => ({
  Bar: () => <div data-testid="bar-chart" />
}))

describe('Stats component', () => {
  const defaultStats = {
    standard: {
      gamesPlayed: 10,
      gamesWon: 8,
      currentStreak: 2,
      maxStreak: 5,
      crownGamesPlayed: 5,
      crownGamesWon: 4,
      crownCurrentStreak: 1,
      crownMaxStreak: 3,
      guesses: { 1: 0, 2: 1, 3: 2, 4: 3, 5: 1, 6: 1 }
    }
  }

  const defaultGameState = {
    dictionary: 'standard',
    status: 'won',
    guesses: ['apple', 'berry', 'robot']
  }

  const mockOnToast = vi.fn()
  const mockOnPlayAgain = vi.fn()
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup navigator mocks
    Object.defineProperty(navigator, 'share', { value: vi.fn(), configurable: true })
    Object.defineProperty(navigator, 'canShare', { value: vi.fn(), configurable: true })
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        write: vi.fn(),
        writeText: vi.fn()
      },
      configurable: true
    })
    
    // Mock Blob and File
    global.Blob = class Blob {}
    global.File = class File {}
    
    // Mock canvas toBlob
    global.HTMLCanvasElement.prototype.toBlob = function(callback) {
      callback(new Blob())
    }
  })

  afterEach(cleanup)

  it('invokes navigator.share when canShare is true', async () => {
    navigator.canShare.mockReturnValue(true)
    navigator.share.mockResolvedValue(undefined)
    
    // Mock html2canvas resolving to a canvas
    const mockCanvas = document.createElement('canvas')
    html2canvas.mockResolvedValue(mockCanvas)
    
    render(
      <Stats
        open={true}
        onClose={mockOnClose}
        stats={defaultStats}
        gameState={defaultGameState}
        word="ROBOT"
        onPlayAgain={mockOnPlayAgain}
        onToast={mockOnToast}
      />
    )
    
    const shareButton = screen.getByText(/Share Image/)
    fireEvent.click(shareButton)
    
    await waitFor(() => {
      expect(navigator.share).toHaveBeenCalled()
      // Button resets
      expect(shareButton.textContent).toMatch(/Share Image/)
    })
  })

  it('handles AbortError quietly when user closes share sheet', async () => {
    navigator.canShare.mockReturnValue(true)
    navigator.share.mockRejectedValue(new DOMException('User aborted', 'AbortError'))
    
    const mockCanvas = document.createElement('canvas')
    html2canvas.mockResolvedValue(mockCanvas)
    
    render(
      <Stats
        open={true}
        onClose={mockOnClose}
        stats={defaultStats}
        gameState={defaultGameState}
        word="ROBOT"
        onPlayAgain={mockOnPlayAgain}
        onToast={mockOnToast}
      />
    )
    
    const shareButton = screen.getByText(/Share Image/)
    fireEvent.click(shareButton)
    
    await waitFor(() => {
      expect(navigator.share).toHaveBeenCalled()
      // Should NOT toast an error if it's an AbortError
      expect(mockOnToast).not.toHaveBeenCalled()
      // Button resets
      expect(shareButton.textContent).toMatch(/Share Image/)
    })
  })

  it('falls back to clipboard.write if canShare is false', async () => {
    navigator.canShare.mockReturnValue(false)
    navigator.clipboard.write.mockResolvedValue(undefined)
    
    const mockCanvas = document.createElement('canvas')
    html2canvas.mockResolvedValue(mockCanvas)
    
    render(
      <Stats
        open={true}
        onClose={mockOnClose}
        stats={defaultStats}
        gameState={defaultGameState}
        word="ROBOT"
        onPlayAgain={mockOnPlayAgain}
        onToast={mockOnToast}
      />
    )
    
    const shareButton = screen.getByText(/Share Image/)
    fireEvent.click(shareButton)
    
    await waitFor(() => {
      expect(navigator.share).not.toHaveBeenCalled()
      expect(navigator.clipboard.write).toHaveBeenCalled()
      expect(shareButton.textContent).toBe('Copied Image!')
    })
  })

  it('falls back to clipboard.writeText if clipboard.write fails', async () => {
    navigator.canShare.mockReturnValue(false)
    navigator.clipboard.write.mockRejectedValue(new Error('NotAllowedError'))
    navigator.clipboard.writeText.mockResolvedValue(undefined)
    
    const mockCanvas = document.createElement('canvas')
    html2canvas.mockResolvedValue(mockCanvas)
    
    render(
      <Stats
        open={true}
        onClose={mockOnClose}
        stats={defaultStats}
        gameState={defaultGameState}
        word="ROBOT"
        onPlayAgain={mockOnPlayAgain}
        onToast={mockOnToast}
      />
    )
    
    const shareButton = screen.getByText(/Share Image/)
    fireEvent.click(shareButton)
    
    await waitFor(() => {
      expect(navigator.clipboard.write).toHaveBeenCalled()
      expect(navigator.clipboard.writeText).toHaveBeenCalled()
      expect(shareButton.textContent).toBe('Copied Image!')
    })
  })
})
