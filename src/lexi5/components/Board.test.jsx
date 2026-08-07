// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { Board } from './Board'

describe('Board component', () => {
  afterEach(cleanup)

  it('renders a grid with 6 rows of 5 tiles', () => {
    const { container } = render(
      <Board 
        guesses={[]} 
        currentGuess="" 
        word="apple" 
        status="playing" 
      />
    )
    
    const board = container.firstChild
    expect(board.children.length).toBe(6)
    
    const firstRow = board.children[0]
    expect(firstRow.children.length).toBe(5)
  })

  it('correctly applies statuses to submitted rows', () => {
    // word is 'apple', guess is 'ample'
    const { container } = render(
      <Board 
        guesses={['ample']} 
        currentGuess="" 
        word="apple" 
        status="playing" 
      />
    )
    
    const firstRowTiles = container.firstChild.children[0].children
    
    expect(firstRowTiles[0].className).toMatch(/correct/)
    expect(firstRowTiles[1].className).toMatch(/absent/)
    expect(firstRowTiles[2].className).toMatch(/correct/)
    expect(firstRowTiles[3].className).toMatch(/correct/)
    expect(firstRowTiles[4].className).toMatch(/correct/)
  })

  it('applies shake animation to the current row if invalidGuess is true', () => {
    const { container } = render(
      <Board 
        guesses={['first']} 
        currentGuess="zzzzz" 
        word="apple" 
        status="playing" 
        invalidGuess={true}
      />
    )
    
    const activeRow = container.firstChild.children[1]
    expect(activeRow.className).toMatch(/shake/)
  })

  it('applies dance animation to the winning row', () => {
    const { container } = render(
      <Board 
        guesses={['apple']} 
        currentGuess="" 
        word="apple" 
        status="won" 
      />
    )
    
    const firstRow = container.firstChild.children[0]
    expect(firstRow.className).toMatch(/dance/)
  })
})
