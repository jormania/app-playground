import { useCallback } from 'react'
import { buildShareText, shareOrCopy } from './share'

export interface ShareResultGameState {
  date: string
  iteration: number
  dictionary: string
  guesses: string[]
  status: string
  difficulty: string
}

export interface UseShareResultOptions {
  gameState: ShareResultGameState
  word: string
  dictionaryLabel: string
  highContrast?: boolean
  hintUsed?: boolean
  onToast?: (message: string) => void
}

/**
 * The one "share your result" action: a score, an emoji grid, and a link to play the same
 * word — never the answer. The result bar and the Statistics panel both call this rather
 * than each growing its own variant, which is how the app ended up with an image render, a
 * plain-text grid and a plain-text stats summary all doing roughly the same job and saying
 * three different things to whoever received them.
 */
export function useShareResult({
  gameState,
  word,
  dictionaryLabel,
  highContrast,
  hintUsed,
  onToast,
}: UseShareResultOptions): { share: () => Promise<void> } {
  const share = useCallback(async () => {
    const seedStr = encodeURIComponent(
      btoa(`${gameState.date}|${gameState.iteration}|${gameState.dictionary}`)
    )
    const text = buildShareText({
      guesses: gameState.guesses,
      word,
      highContrast,
      dictionaryLabel,
      won: gameState.status === 'won',
      iteration: gameState.iteration,
      hardMode: gameState.difficulty === 'hard',
      hintUsed,
      url: `${window.location.origin}${window.location.pathname}?seed=${seedStr}`,
    })
    const outcome = await shareOrCopy(text)
    if (outcome === 'copied') onToast?.('Result copied to clipboard!')
    else if (outcome === 'failed') onToast?.('Could not share or copy — try again.')
  }, [gameState, word, dictionaryLabel, highContrast, hintUsed, onToast])

  return { share }
}
