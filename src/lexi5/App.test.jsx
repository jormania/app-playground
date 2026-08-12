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

  it("does not restart a showing toast's timer just because a second toast got queued behind it", () => {
    // Regression test: the queue effect originally depended on [toast, toastQueue], so
    // pushing a new message onto the queue re-ran the effect and re-armed a fresh 2000ms
    // timer for whatever toast was already showing — silently extending its display time
    // by up to another full dwell every time something else got queued behind it.
    // Only fake setTimeout/clearTimeout — faking everything (the vitest default) also
    // fakes APIs React's own scheduler relies on (e.g. queueMicrotask/MessageChannel),
    // which stops `act()` from flushing updates during this test.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      // Each keystroke needs its own act() so the next one's event handler closes over
      // the state update the previous one just committed — batching several dispatches
      // into one act() call means later handlers (like Enter) still see the stale
      // pre-keystroke state, same reason the `typeWord` helper above presses one key
      // per act().
      const press = (key) => act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key }))
      })
      const typeAndEnter = (word) => {
        for (const c of word) press(c)
        press('Enter')
      }

      render(<App />)

      typeAndEnter('rooms')

      // First toast appears.
      typeAndEnter('aaaaa')
      expect(screen.getByText(/Must use R in position 1/i)).toBeTruthy()

      // Just before the first toast would naturally expire, queue a second, distinct one.
      act(() => {
        vi.advanceTimersByTime(1900)
      })
      for (let i = 0; i < 5; i++) press('Backspace')
      typeAndEnter('rovvv')

      // Total elapsed since the first toast appeared is now 2100ms — past its original
      // 2000ms dwell. A timer-restart bug would keep it alive far longer than this.
      act(() => {
        vi.advanceTimersByTime(200)
      })
      expect(screen.queryByText(/Must use R in position 1/i)).toBeNull()
      expect(screen.getByText(/Guess must contain O/i)).toBeTruthy()
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not play the game while a modal is covering the board', async () => {
    // Regression: the keydown listener was on `window` with no modal or form-target
    // guard, so typing a curation theme into Settings typed onto the board behind it —
    // and Enter there submitted a real guess, spending one of six attempts (and the
    // Crown game) while the player was only naming a theme.
    render(<App />)

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' }))
    })
    expect(screen.getAllByText('R').length).toBeGreaterThan(0)

    act(() => {
      screen.getByTitle('Settings').click()
    })

    const before = screen.queryAllByText('O').length
    await typeWord('robot')
    expect(screen.queryAllByText('O').length).toBe(before)
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
