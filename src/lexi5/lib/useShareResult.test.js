// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useShareResult } from './useShareResult'

const baseGameState = {
  date: 'Wed Aug 12 2026',
  iteration: 0,
  dictionary: 'standard',
  status: 'won',
  guesses: ['crane', 'robot'],
  difficulty: 'normal',
}

describe('useShareResult', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true })
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    })
  })

  it('shares the score and grid, never the answer, and toasts on copy', async () => {
    const onToast = vi.fn()
    const { result } = renderHook(() =>
      useShareResult({
        gameState: baseGameState,
        word: 'robot',
        dictionaryLabel: 'Standard',
        onToast,
      })
    )

    await act(() => result.current.share())

    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1)
    const [text] = navigator.clipboard.writeText.mock.calls[0]
    expect(text).toContain('2/6')
    expect(text.toLowerCase()).not.toContain('robot')
    expect(onToast).toHaveBeenCalledWith('Result copied to clipboard!')
  })

  it('reports a copy failure instead of pretending it worked', async () => {
    navigator.clipboard.writeText.mockRejectedValue(new Error('denied'))
    const onToast = vi.fn()
    const { result } = renderHook(() =>
      useShareResult({ gameState: baseGameState, word: 'robot', dictionaryLabel: 'Standard', onToast })
    )

    await act(() => result.current.share())

    expect(onToast).toHaveBeenCalledWith('Could not share or copy — try again.')
  })
})
