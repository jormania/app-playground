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

  it('names the endless round number', () => {
    expect(buildShareText({ ...base, iteration: 3 }).split('\n')[0]).toContain('Endless #3')
  })

  it('reports a loss as X/6', () => {
    expect(buildShareText({ ...base, won: false }).split('\n')[0]).toContain('X/6')
  })

  it('marks hard mode and hints so a score never claims to be unaided', () => {
    expect(buildShareText({ ...base, hardMode: true }).split('\n')[0]).toContain('2/6*')
    expect(buildShareText({ ...base, hintUsed: true }).split('\n')[0]).toContain('2/6?')
    expect(buildShareText({ ...base, hardMode: true, hintUsed: true }).split('\n')[0]).toContain('2/6*?')
  })

  it('appends the link only when one is given', () => {
    expect(buildShareText(base)).not.toContain('http')
    expect(buildShareText({ ...base, url: 'https://example.test/x' })).toContain('https://example.test/x')
  })
})
