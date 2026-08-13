import { scoreGuess, type TileStatus } from './score'

/**
 * The emoji grid — the format a result actually travels in.
 *
 * The app could already share a rendered image and a block of stats text, but not this:
 * the one thing that pastes into any chat, reads correctly on every platform, and gives
 * nothing away about the answer. It's built from the same `scoreGuess` the board uses, so
 * a shared grid can't disagree with what the player saw.
 */

// Wordle's own convention, including the colour-vision-friendly swap. Black/white squares
// follow the viewer's own theme rather than ours — an absent tile reads as "empty" either
// way, so the standard pair is used regardless of the player's light/dark setting.
const GLYPHS: Record<'normal' | 'highContrast', Record<TileStatus, string>> = {
  normal: { correct: '🟩', present: '🟨', absent: '⬛' },
  highContrast: { correct: '🟧', present: '🟦', absent: '⬛' },
}

export interface ShareGridOptions {
  guesses: string[]
  word: string
  highContrast?: boolean
}

/** Just the grid rows, newline-separated. */
export function buildEmojiGrid({ guesses, word, highContrast = false }: ShareGridOptions): string {
  const glyphs = GLYPHS[highContrast ? 'highContrast' : 'normal']
  return guesses
    .map(guess => scoreGuess(guess, word).map(status => glyphs[status]).join(''))
    .join('\n')
}

export interface ShareTextOptions extends ShareGridOptions {
  dictionaryLabel: string
  won: boolean
  /** 0 is the day's Crown word; anything higher is an Endless round. */
  iteration: number
  hardMode?: boolean
  hintUsed?: boolean
  url?: string
}

/**
 * The full shareable message: a heading, the grid, and optionally a link.
 *
 * Deliberately never contains the answer — not in the heading, not in the link (which
 * encodes date/iteration/dictionary, not the word). Someone can paste this into a group
 * chat without spoiling anyone who hasn't played yet.
 */
export function buildShareText(options: ShareTextOptions): string {
  const { dictionaryLabel, won, iteration, guesses, hardMode, hintUsed, url } = options

  const round = iteration === 0 ? 'Daily' : `Endless #${iteration}`
  const score = won ? `${guesses.length}/6` : 'X/6'

  // Spelled out rather than the `*`/`?` shorthand this used to append straight onto the
  // score (e.g. "3/6*?") — that read as a typo to anyone who hadn't memorized what each
  // symbol meant, including the player who just sent it. A legend for the symbols existed
  // in code but was never actually shown anywhere, to the sender or the recipient.
  const notes: string[] = []
  if (hardMode) notes.push('Hard Mode')
  if (hintUsed) notes.push('used a hint')
  const noteSuffix = notes.length > 0 ? ` (${notes.join(', ')})` : ''

  const lines = [
    `Lexi5 ${round} · ${dictionaryLabel} · ${score}${noteSuffix}`,
    '',
    buildEmojiGrid(options),
  ]
  if (url) lines.push('', url)
  return lines.join('\n')
}

export type ShareOutcome = 'shared' | 'copied' | 'failed'

/**
 * Hands text to the native share sheet, falling back to the clipboard.
 *
 * Both the result bar and the Statistics panel offer the same grid, so they go through
 * one function rather than each re-deriving what counts as success — a dismissed share
 * sheet is not a failure, and must not fall through to a silent clipboard write the
 * player didn't ask for.
 */
export async function shareOrCopy(text: string): Promise<ShareOutcome> {
  if (navigator.share && navigator.canShare && navigator.canShare({ text })) {
    try {
      await navigator.share({ text })
      return 'shared'
    } catch (err) {
      if ((err as Error).name === 'AbortError') return 'shared'
      // A real share failure still deserves the clipboard fallback below.
    }
  }
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'failed'
  }
}
