import { test, expect, describe } from 'vitest'
import { alreadyHasThemeHighlight, dramatizeRichText, THEME_COLORS } from './clickdeckDramatize.js'

function plainRun(content, annotations = {}) {
  return {
    type: 'text',
    text: { content },
    annotations: {
      bold: false, italic: false, strikethrough: false, underline: false, code: false, color: 'default',
      ...annotations
    }
  }
}

describe('alreadyHasThemeHighlight', () => {
  test('false for a single plain run', () => {
    expect(alreadyHasThemeHighlight([plainRun('A fine adventure game.')])).toBe(false)
  })

  test('false for a run with manual bold but no theme color', () => {
    expect(alreadyHasThemeHighlight([plainRun('very good', { bold: true })])).toBe(false)
  })

  test('true when any run already carries a theme color', () => {
    expect(alreadyHasThemeHighlight([plainRun('a'), plainRun('mystery', { color: 'blue' })])).toBe(true)
  })

  test('a color outside the theme palette does not count as already-highlighted', () => {
    expect(alreadyHasThemeHighlight([plainRun('x', { color: 'gray' })])).toBe(false)
  })
})

describe('THEME_COLORS', () => {
  test('has exactly the 7 colors the theme table assigns', () => {
    expect([...THEME_COLORS].sort()).toEqual(['blue', 'green', 'orange', 'pink', 'purple', 'red', 'yellow'])
  })
})

describe('dramatizeRichText', () => {
  test('highlights a keyword and preserves surrounding plain text', () => {
    const { segments, highlighted } = dramatizeRichText([plainRun('A gripping mystery unfolds.')])
    expect(highlighted).toBe(1)
    const texts = segments.map(s => s.text.content)
    expect(texts.join('')).toBe('A gripping mystery unfolds.')
    const hit = segments.find(s => s.text.content === 'mystery')
    expect(hit.annotations.color).toBe('blue')
  })

  test('preserves an existing run\'s bold/annotations on segments it does not touch, and merges (not clears) bold on the matched span', () => {
    const runs = [plainRun('This is a '), plainRun('gorgeous', { bold: true }), plainRun(' mystery.')]
    const { segments } = dramatizeRichText(runs)
    const boldPlain = segments.find(s => s.text.content === 'gorgeous')
    expect(boldPlain.annotations.bold).toBe(true) // classic theme also bolds — stays true either way
    expect(boldPlain.annotations.color).toBe('orange')
    const untouched = segments.find(s => s.text.content === 'This is a ')
    expect(untouched.annotations.bold).toBe(false)
  })

  test('merges theme emphasis onto a run that had unrelated existing bold, without losing that bold', () => {
    // "detective" (mystery theme, color-only, no bold/italic) inside a run
    // that was already manually bolded for an unrelated reason.
    const runs = [plainRun('A tough detective story.', { bold: true })]
    const { segments } = dramatizeRichText(runs)
    const hit = segments.find(s => s.text.content === 'detective')
    expect(hit.annotations.bold).toBe(true) // preserved from the run's own bold
    expect(hit.annotations.color).toBe('blue') // mystery theme color applied
  })

  test('caps highlights at 3 per entry, across multiple runs', () => {
    const runs = [plainRun('horror mystery comedy story classic atmospheric')]
    const { highlighted } = dramatizeRichText(runs)
    expect(highlighted).toBe(3)
  })

  test('returns 0 highlighted and untouched segments when no keyword matches', () => {
    const { segments, highlighted } = dramatizeRichText([plainRun('A quiet little walk.')])
    expect(highlighted).toBe(0)
    expect(segments).toHaveLength(1)
    expect(segments[0].text.content).toBe('A quiet little walk.')
  })

  test('matches are case-insensitive and word-bounded (does not match inside another word)', () => {
    const { highlighted, segments } = dramatizeRichText([plainRun('AI runs the Aisle and the airport.')])
    expect(highlighted).toBe(1)
    expect(segments.some(s => s.text.content === 'AI')).toBe(true)
  })

  test('a hyphenated keyword like sci-fi matches at word boundaries', () => {
    const { highlighted, segments } = dramatizeRichText([plainRun('A moody sci-fi mystery.')])
    expect(highlighted).toBe(2)
    expect(segments.some(s => s.text.content === 'sci-fi')).toBe(true)
  })
})
