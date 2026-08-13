import { describe, it, expect } from 'vitest'
import { buildEmojiGrid, buildShareText } from './share'

describe('buildEmojiGrid', () => {
  it('renders one row of glyphs per guess', () => {
    const grid = buildEmojiGrid({ guesses: ['crane', 'robot'], word: 'robot' })
    expect(grid.split('\n')).toHaveLength(2)
    expect(grid.split('\n')[1]).toBe('🟩🟩🟩🟩🟩')
  })

  it('uses the same scoring as the board, including letter counts', () => {
    // ROBOT has exactly two O's, both on exact matches — nothing left over to be yellow.
    // A naive scorer would emit five yellows here.
    expect(buildEmojiGrid({ guesses: ['ooooo'], word: 'robot' })).toBe('⬛🟩⬛🟩⬛')
  })

  it('swaps to the colour-vision-friendly glyphs in high contrast', () => {
    const normal = buildEmojiGrid({ guesses: ['rooms'], word: 'robot' })
    const highContrast = buildEmojiGrid({ guesses: ['rooms'], word: 'robot', highContrast: true })
    expect(normal).toBe('🟩🟩🟨⬛⬛')
    expect(highContrast).toBe('🟧🟧🟦⬛⬛')
  })
})

describe('buildEmojiGrid — empty input', () => {
  it('produces nothing to share when no guesses were made', () => {
    // A forfeit with an empty board has no grid; the UI hides the button rather than
    // offering a share that says nothing.
    expect(buildEmojiGrid({ guesses: [], word: 'robot' })).toBe('')
  })
})

describe('buildShareText', () => {
  const base = {
    guesses: ['crane', 'robot'],
    word: 'robot',
    dictionaryLabel: 'Standard',
    won: true,
    iteration: 0,
  }

  it('never contains the answer', () => {
    const text = buildShareText({ ...base, url: 'https://example.test/?seed=abc' })
    expect(text.toLowerCase()).not.toContain('robot')
  })

  it('heads the daily round with its score', () => {
    expect(buildShareText(base).split('\n')[0]).toBe('Lexi5 Daily · Standard · 2/6')
  })

  it('labels an Endless round without its internal, all-time-per-dictionary round number', () => {
    // That count is meaningless to whoever receives the message (and confusing to the
    // player themselves — it doesn't reset daily and isn't "this is your Nth game today").
    expect(buildShareText({ ...base, iteration: 3 }).split('\n')[0]).toContain('Endless')
    expect(buildShareText({ ...base, iteration: 3 }).split('\n')[0]).not.toContain('#')
  })

  it('reports a loss as X/6', () => {
    expect(buildShareText({ ...base, won: false }).split('\n')[0]).toContain('X/6')
  })

  it('spells out hard mode and hint use so a score never claims to be unaided', () => {
    // Plain words rather than the old `*`/`?` shorthand, which read as a typo to anyone
    // who hadn't memorized what the symbols meant — including the player sending it.
    expect(buildShareText({ ...base, hardMode: true }).split('\n')[0]).toContain('2/6 (Hard Mode)')
    expect(buildShareText({ ...base, hintUsed: true }).split('\n')[0]).toContain('2/6 (used a hint)')
    expect(buildShareText({ ...base, hardMode: true, hintUsed: true }).split('\n')[0])
      .toContain('2/6 (Hard Mode, used a hint)')
  })

  it('appends the link only when one is given', () => {
    expect(buildShareText(base)).not.toContain('http')
    expect(buildShareText({ ...base, url: 'https://example.test/x' })).toContain('https://example.test/x')
  })
})
