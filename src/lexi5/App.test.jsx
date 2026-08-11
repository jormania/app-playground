// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, cleanup, screen, act } from '@testing-library/react'
import { App } from './App'
import * as gameState from './lib/gameState'
import * as config from './lib/config'

// Mock dependencies
vi.mock('./lib/gameState', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getWord: vi.fn(),
    isValidGuess: vi.fn()
  }
})

vi.mock('./lib/config', () => ({
  useConfig: vi.fn()
}))

// Mock canvas-confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn()
}))

// Mock haptics
vi.mock('./lib/haptics', () => ({
  hapticTap: vi.fn(),
  hapticError: vi.fn(),
  hapticWin: vi.fn()
}))

const localStorageMock = (() => {
  let store = {}
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString() },
    removeItem: (key) => { delete store[key] },
    clear: () => { store = {} }
  }
})()
vi.stubGlobal('localStorage', localStorageMock)

describe('App component (Hard Mode Validation)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    
    // Set config to Hard Mode
    config.useConfig.mockReturnValue({
      config: {
        difficulty: 'hard',
        dictionary: 'standard',
        theme: 'light',
        smartKeyboard: true
      },
      updateConfig: vi.fn()
    })
    
    // Mock target word and validity
    gameState.getWord.mockReturnValue('robot')
    gameState.isValidGuess.mockReturnValue(true)
    
    // Reset toast state by resetting DOM (happy-dom handles this between tests)
  })

  afterEach(cleanup)

  const typeWord = async (word) => {
    for (const char of word) {
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: char }))
      })
    }
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    })
  }

  it('rejects guess if a required yellow letter (duplicate) is missing', async () => {
    render(<App />)
    
    // Target word: ROBOT
    // Guess 1: BOOTS (B: yellow, O: green, O: yellow, T: yellow, S: absent)
    // Wait, ROBOT has two O's.
    // Let's guess 'COLOR'
    // C: absent, O: green, L: absent, O: green, R: yellow. (Wait, ROBOT is R-O-B-O-T).
    // Let's do guess 1: 'BOOBO'
    // Actually, let's use 'ROTOR' against 'ROBOT'
    // R: green, O: green, T: yellow, O: green, R: absent
    
    // Let's use simpler guess: 'ROOMS' against 'ROBOT'
    // R: green, O: green, O: yellow (since ROBOT has another O), M: absent, S: absent
    await typeWord('rooms')
    
    // Now we must use the second O somewhere, and R and the first O in their exact spots.
    // Let's guess 'ROMAN'
    // R: green (matches), O: green (matches), M: absent, A: absent, N: absent.
    // BUT we failed to include the second O (which was yellow).
    await typeWord('roman')
    
    // We expect a toast rejecting this because we missed the yellow 'o'
    const toast = await screen.findByText(/Guess must contain O/i)
    expect(toast).toBeTruthy()
  })

  it('queues a second distinct toast instead of dropping it while one is already showing', async () => {
    render(<App />)

    await typeWord('rooms')

    // First Hard Mode violation: drop the required green R at position 1.
    await typeWord('aaaaa')
    expect(await screen.findByText(/Must use R in position 1/i)).toBeTruthy()

    // Clear the rejected guess and, immediately (before the first toast's ~2s dwell
    // elapses), fire a second violation with a *different* message. It should queue
    // behind the first rather than silently overwriting it.
    for (let i = 0; i < 5; i++) {
      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }))
      })
    }
    await typeWord('rovvv')

    // Right after firing it, the first toast is still the one on screen — the second
    // hasn't silently replaced it.
    expect(screen.getByText(/Must use R in position 1/i)).toBeTruthy()
    expect(screen.queryByText(/Guess must contain O/i)).toBeNull()

    // Once the first toast's dwell time elapses, the queued one takes its place.
    expect(await screen.findByText(/Guess must contain O/i, {}, { timeout: 3000 })).toBeTruthy()
  })

  it('accepts guess if duplicate letter rules are followed', async () => {
    render(<App />)
    
    // Target word: ROBOT
    // Guess 1: 'ROOMS'
    // R: green, O: green, O: yellow, M: absent, S: absent
    await typeWord('rooms')
    
    // Guess 2: 'RODEO'
    // R: green, O: green, D: absent, E: absent, O: yellow (we used the yellow O!)
    await typeWord('rodeo')
    
    // Should NOT get the "Guess must contain O" toast.
    // Instead, the guess should be accepted, meaning the row updates.
    // We can verify no error toast appeared.
    const errorToast = screen.queryByText(/Guess must contain/i)
    expect(errorToast).toBeNull()
  })
})
