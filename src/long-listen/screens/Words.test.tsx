// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
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

afterEach(cleanup)

describe('the dictionary page', () => {
  it('lists the words A to Z with their letter in the margin, and narrows to a search or a kind', () => {
    render(<WordsScreen />)
    expect(screen.getByRole('heading', { name: 'The words of the orchestra' })).toBeTruthy()
    expect(screen.getByLabelText('Words beginning with A')).toBeTruthy()
    expect(screen.getByText('adagio')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Search the words'), { target: { value: 'kettledrums' } })
    expect(screen.getByText('timpani')).toBeTruthy()
    expect(screen.queryByText('adagio')).toBeNull()
    fireEvent.change(screen.getByLabelText('Search the words'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Periods and styles' }))
    expect(screen.getByText('baroque')).toBeTruthy()
    expect(screen.queryByText('adagio')).toBeNull()
  })

  it('narrows, as the Library does, to the words the notes underline, or to those in this week’s notes', async () => {
    render(<WordsScreen />)
    fireEvent.click(screen.getByRole('radio', { name: 'In your notes' }))
    expect(screen.getByText('adagio')).toBeTruthy()
    expect(screen.queryByText('baroque')).toBeNull()
    fireEvent.click(await screen.findByRole('radio', { name: 'This week · 2' }))
    expect(screen.getByText('passacaglia')).toBeTruthy()
    expect(screen.getByText('adagio')).toBeTruthy()
    expect(screen.queryByText('fugue')).toBeNull()
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
})
