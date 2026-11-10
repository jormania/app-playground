// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { Programme } from '../domain/types'

// This week's programme: its notes underline "passacaglia" and "adagio", nothing else.
const programme = {
  id: 'p1', weekKey: '2026-W46', dek: 'A week of slow music.', introduction: 'It ends on a passacaglia.', whyNow: '', historicalPlace: '', howTheyRelate: '',
  sections: [{ id: 's', role: 'start', heading: 'Start here', items: [{ id: 'i', why: 'The Adagio is its heart.', whyThisRecording: '', listenFor: [] }] }],
} as unknown as Programme

vi.mock('../app/services', async () => {
  const { useEffect, useState } = await import('react')
  return {
    useServices: () => ({ repo: { programmes: { all: async () => [programme] } }, week: { key: '2026-W46' } }),
    useLoad: (load: () => Promise<unknown>, deps: unknown[]) => {
      const [data, setData] = useState<unknown>()
      // eslint-disable-next-line react-hooks/exhaustive-deps
      useEffect(() => { void load().then(setData) }, deps)
      return { data }
    },
  }
})
const { WordsScreen, weekPassages } = await import('./Words')
const { wordAnchor, crossReferences } = await import('../domain/dictionary')

beforeEach(() => { sessionStorage.clear() })
afterEach(cleanup)

/** A word's own entry on the page (its name also turns up inside other words' definitions). */
const entry = (term: string) => document.getElementById(wordAnchor(term))

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
    fireEvent.click(screen.getByRole('radio', { name: 'Periods and styles' }))
    expect(entry('baroque')).toBeTruthy()
    expect(entry('adagio')).toBeNull()
  })

  it('narrows, as the Library does, to the words the notes underline, or to those in this week’s notes', async () => {
    render(<WordsScreen />)
    fireEvent.click(screen.getByRole('radio', { name: 'In your notes' }))
    expect(entry('adagio')).toBeTruthy()
    expect(entry('baroque')).toBeNull()
    fireEvent.click(await screen.findByRole('radio', { name: 'This week · 2' }))
    expect(entry('passacaglia')).toBeTruthy()
    expect(entry('adagio')).toBeTruthy()
    expect(entry('fugue')).toBeNull()
    expect(screen.getByRole('status').textContent).toMatch(/^2 of \d+ words$/)
  })

  it('reads only this week’s programmes', () => {
    expect(weekPassages([programme], '2026-W45')).toEqual([])
    expect(weekPassages([programme], '2026-W46')).toContain('The Adagio is its heart.')
  })

  it('says so when nothing matches', () => {
    render(<WordsScreen />)
    fireEvent.change(screen.getByLabelText('Search the words'), { target: { value: 'zzzz' } })
    expect(screen.getByText(/No word matches/)).toBeTruthy()
  })

  it('follows a word named in another’s definition to its own entry, clearing what would hide it', () => {
    render(<WordsScreen />)
    fireEvent.click(screen.getByRole('radio', { name: 'Periods and styles' }))
    expect(entry('exposition')).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: 'Every kind' }))
    fireEvent.change(screen.getByLabelText('Search the words'), { target: { value: 'sonata form' } })
    const link = [...entry('sonata form')!.querySelectorAll('button')].find((b) => b.textContent === 'exposition')!
    fireEvent.click(link)
    expect((screen.getByLabelText('Search the words') as HTMLInputElement).value).toBe('')
    expect(entry('exposition')).toBeTruthy()
  })

  it('keeps the search and the chips for the tab, as the Library does', () => {
    const first = render(<WordsScreen />)
    fireEvent.change(screen.getByLabelText('Search the words'), { target: { value: 'bow' } })
    fireEvent.click(screen.getByRole('radio', { name: 'In your notes' }))
    first.unmount()
    render(<WordsScreen />)
    expect((screen.getByLabelText('Search the words') as HTMLInputElement).value).toBe('bow')
    expect(screen.getByRole('radio', { name: 'In your notes' }).getAttribute('aria-checked')).toBe('true')
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
