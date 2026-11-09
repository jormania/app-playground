// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { WordsScreen } from './Words'

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

  it('says so when nothing matches', () => {
    render(<WordsScreen />)
    fireEvent.change(screen.getByLabelText('Search the words'), { target: { value: 'zzzz' } })
    expect(screen.getByText(/No word matches/)).toBeTruthy()
  })
})
