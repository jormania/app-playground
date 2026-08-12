// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, cleanup, screen, act, waitFor } from '@testing-library/react'
import { App } from './App'
import * as gameState from './lib/gameState'
import * as config from './lib/config'

vi.mock('./lib/gameState', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getWord: vi.fn(),
    isValidGuess: vi.fn(),
  }
})

vi.mock('./lib/config', () => ({
  useConfig: vi.fn(),
}))

vi.mock('canvas-confetti', () => ({ default: vi.fn() }))
vi.mock('./lib/haptics', () => ({ hapticTap: vi.fn(), hapticError: vi.fn(), hapticWin: vi.fn() }))

const localStorageMock = (() => {
  let store = {}
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString() },
    removeItem: (key) => { delete store[key] },
    clear: () => { store = {} },
  }
})()
vi.stubGlobal('localStorage', localStorageMock)

const press = (key) => act(() => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }))
})
const typeWord = (word) => {
  for (const char of word) press(char)
  press('Enter')
}

// The word is "robot"; none of these four guesses match it, so the game is still
// "playing" with guesses.length === 4 — exactly the gate the hint button sits behind.
const revealHintButton = () => {
  typeWord('aaaaa')
  typeWord('bbbbb')
  typeWord('ccccc')
  typeWord('ddddd')
}

describe('Lexi5 hint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    config.useConfig.mockReturnValue({
      config: { difficulty: 'normal', dictionary: 'standard', theme: 'light', smartKeyboard: true },
      updateConfig: vi.fn(),
    })
    gameState.getWord.mockReturnValue('robot')
    gameState.isValidGuess.mockReturnValue(true)
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('reveals a definition and marks the hint used once one is actually delivered', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ meanings: [{ definitions: [{ definition: 'A humanoid machine.' }] }] }],
    }))

    render(<App />)
    revealHintButton()

    const button = await screen.findByText(/Stuck\? Reveal a definition/i)
    act(() => { button.click() })

    expect(await screen.findByText(/A humanoid machine\./)).toBeTruthy()
    // The button that spends the hint is gone — it can't be used twice.
    expect(screen.queryByText(/Stuck\? Reveal a definition/i)).toBeNull()
  })

  it('does not burn the hint when the API has no entry for the word', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))

    render(<App />)
    revealHintButton()

    const button = await screen.findByText(/Stuck\? Reveal a definition/i)
    act(() => { button.click() })

    expect(await screen.findByText(/No definition found for this word/i)).toBeTruthy()
    // Nothing was actually delivered, so the player hasn't spent their hint — the
    // button stays available rather than disappearing on a lookup that gave them nothing.
    expect(screen.getByText(/Stuck\? Reveal a definition/i)).toBeTruthy()
  })

  it('does not burn the hint, and does not blame the connection, on a genuine fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    render(<App />)
    revealHintButton()

    const button = await screen.findByText(/Stuck\? Reveal a definition/i)
    act(() => { button.click() })

    expect(await screen.findByText(/try again in a moment/i)).toBeTruthy()
    expect(screen.getByText(/Stuck\? Reveal a definition/i)).toBeTruthy()
  })

  it('actually retries on a second click after a failure, instead of replaying the same cached error', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [{ meanings: [{ definitions: [{ definition: 'A humanoid machine.' }] }] }],
      })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)
    revealHintButton()

    const button = await screen.findByText(/Stuck\? Reveal a definition/i)
    act(() => { button.click() })
    await screen.findByText(/try again in a moment/i)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    act(() => { button.click() })
    expect(await screen.findByText(/A humanoid machine\./)).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not re-fetch the definition for Stats once the hint already fetched it', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ meanings: [{ definitions: [{ definition: 'A humanoid machine.' }] }] }],
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)
    revealHintButton()

    const button = await screen.findByText(/Stuck\? Reveal a definition/i)
    act(() => { button.click() })
    await screen.findByText(/A humanoid machine\./)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // Finish the game (2 more wrong guesses exhausts all 6) and open Stats — it should
    // reuse the hint's already-fetched definition instead of asking the API again.
    typeWord('eeeee')
    typeWord('fffff')

    act(() => { screen.getByTitle('Statistics').click() })

    await waitFor(() => {
      expect(screen.getAllByText(/A humanoid machine\./).length).toBeGreaterThan(0)
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
