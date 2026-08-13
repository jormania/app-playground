// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { render, cleanup, screen, act } from '@testing-library/react'
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

describe('Lexi5 — getting back to a new game after one ends', () => {
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

  afterEach(cleanup)

  const loseTheGame = () => {
    typeWord('aaaaa')
    typeWord('bbbbb')
    typeWord('ccccc')
    typeWord('ddddd')
    typeWord('eeeee')
    typeWord('fffff')
  }

  it('offers Play Again on the main screen once the game ends, before touching the result bar', async () => {
    render(<App />)
    loseTheGame()

    expect(await screen.findByRole('button', { name: 'Play Again' })).toBeTruthy()
  })

  it('keeps Play Again available after the result bar is dismissed — dismissing it only hides the summary, not the game-over state', async () => {
    render(<App />)
    loseTheGame()

    await screen.findByRole('button', { name: 'Play Again' })
    // The result bar itself only appears ~2.2s after the game ends (after the victory/
    // defeat animation settles), well past testing-library's default 1s findBy timeout.
    const dismiss = await screen.findByTitle('Dismiss', {}, { timeout: 3000 })
    act(() => { dismiss.click() })

    expect(screen.getByRole('button', { name: 'Play Again' })).toBeTruthy()
  })

  it('starts a fresh game from the main-screen button without going through Stats', async () => {
    render(<App />)
    loseTheGame()

    const button = await screen.findByRole('button', { name: 'Play Again' })
    act(() => { button.click() })

    // A fresh game is playing again — the losing board's dead-end state is gone.
    expect(screen.queryByRole('button', { name: 'Play Again' })).toBeNull()
  })
})
