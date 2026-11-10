// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
const { WordsScreen } = await import('./Words')
const { wordAnchor, crossReferences } = await import('../domain/dictionary')

beforeEach(() => { sessionStorage.clear() })
afterEach(cleanup)

/** A word's own entry on the page (its name also turns up inside other words' definitions). */
const entry = (term: string) => document.getElementById(wordAnchor(term))
/** One of the four shelf chips. */
const chip = (name: string) => screen.getByRole('button', { name })

describe('the dictionary page', () => {
  it('lists the words A to Z with their letter in the margin, and narrows to a search or a kind', () => {
    render(<WordsScreen />)
    expect(screen.getByRole('heading', { name: 'The words of the orchestra' })).toBeTruthy()
    expect(screen.getByLabelText('Words beginning with A')).toBeTruthy()
    expect(entry('adagio')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Search the words'), { target: { value: 'kettledrums' } })
    expect(entry('timpani')).toBeTruthy()
    expect(entry('adagio')).toBeNull()
    fireEvent.change(screen.getByLabelText('Search the words'), { target: { value: '' } })
    fireEvent.click(chip('Orchestra'))
    expect(entry('timpani')).toBeTruthy()
    expect(entry('conductor')).toBeTruthy()
    expect(entry('adagio')).toBeNull()
    fireEvent.click(chip('Markings'))
    expect(entry('adagio')).toBeTruthy()
    expect(entry('timpani')).toBeNull()
    // The lit one, tapped again: every word.
    fireEvent.click(chip('Markings'))
    expect(entry('timpani')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toMatch(/^\d+ words$/)
  })

  it('offers one short row of four chips, none lit at first', () => {
    render(<WordsScreen />)
    const chips = [...screen.getByRole('group', { name: 'Show only' }).querySelectorAll('button')]
    expect(chips.map((c) => c.textContent)).toEqual(['Orchestra', 'Forms', 'Markings', 'Harmony'])
    expect(chips.every((c) => c.getAttribute('aria-pressed') === 'false')).toBe(true)
  })

  it('says so when nothing matches', () => {
    render(<WordsScreen />)
    fireEvent.change(screen.getByLabelText('Search the words'), { target: { value: 'zzzz' } })
    expect(screen.getByText(/No word matches/)).toBeTruthy()
  })

  it('follows a word named in another’s definition to its own entry, clearing what would hide it', () => {
    render(<WordsScreen />)
    fireEvent.change(screen.getByLabelText('Search the words'), { target: { value: 'sonata form' } })
    fireEvent.click(chip('Forms'))
    const link = [...entry('sonata form')!.querySelectorAll('button')].find((b) => b.textContent === 'exposition')!
    fireEvent.click(link)
    expect((screen.getByLabelText('Search the words') as HTMLInputElement).value).toBe('')
    expect(chip('Forms').getAttribute('aria-pressed')).toBe('false')
    expect(entry('exposition')).toBeTruthy()
  })

  it('keeps the search and the chips for the tab, as the Library does', () => {
    const first = render(<WordsScreen />)
    fireEvent.change(screen.getByLabelText('Search the words'), { target: { value: 'bow' } })
    fireEvent.click(chip('Orchestra'))
    first.unmount()
    render(<WordsScreen />)
    expect((screen.getByLabelText('Search the words') as HTMLInputElement).value).toBe('bow')
    expect(chip('Orchestra').getAttribute('aria-pressed')).toBe('true')
  })

  it('offers only the letters there are words for, as the page stands', () => {
    render(<WordsScreen />)
    fireEvent.change(screen.getByLabelText('Search the words'), { target: { value: 'kettledrums' } })
    const index = screen.getByRole('navigation', { name: 'Jump to a letter' })
    expect([...index.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['T'])
  })
})

describe('a thing with two names', () => {
  it('stands once, under its main name, with the other beside it', () => {
    render(<WordsScreen />)
    fireEvent.change(screen.getByLabelText('Search the words'), { target: { value: 'english horn' } })
    expect(entry('cor anglais')!.textContent).toContain('also english horn')
    expect(entry('english horn')).toBeNull()
  })
})

describe('cross-references in a definition', () => {
  it('links the specialist words a definition names, once each, never the word itself, never a plain word', () => {
    const refs = crossReferences('Variations over a ground bass, as in a chaconne; a chaconne in a key.', 'chaconne').filter((p) => typeof p !== 'string')
    expect(refs).toEqual([{ term: 'ground bass', text: 'ground bass' }])
  })
})
