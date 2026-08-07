// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { Keyboard } from './Keyboard'

describe('Keyboard component', () => {
  afterEach(cleanup)

  it('renders standard keyboard layout', () => {
    const { getByText } = render(
      <Keyboard 
        guesses={[]} 
        word="apple" 
        onChar={() => {}}
        onDelete={() => {}}
        onEnter={() => {}}
        smartKeyboard={false}
      />
    )
    
    expect(getByText('Q')).toBeDefined()
    expect(getByText('Enter')).toBeDefined()
    expect(getByText('DEL')).toBeDefined()
  })

  it('applies correct, present, and absent classes to keys based on guesses', () => {
    const { getByText } = render(
      <Keyboard 
        guesses={['ample']} 
        word="apple" 
        onChar={() => {}}
        onDelete={() => {}}
        onEnter={() => {}}
        smartKeyboard={false}
      />
    )
    
    // A, P, L, E are correct in 'ample' vs 'apple'
    expect(getByText('A').className).toMatch(/correct/)
    expect(getByText('M').className).toMatch(/absent/)
    expect(getByText('P').className).toMatch(/correct/)
    expect(getByText('L').className).toMatch(/correct/)
    expect(getByText('E').className).toMatch(/correct/)
  })

  it('renders smart dots for yellow keys when smartKeyboard is enabled', () => {
    const { getByText, container } = render(
      <Keyboard 
        guesses={['tasty']} 
        word="apple" 
        onChar={() => {}}
        onDelete={() => {}}
        onEnter={() => {}}
        smartKeyboard={true}
      />
    )
    
    // A is present (yellow)
    const keyA = getByText('A')
    expect(keyA.className).toMatch(/present/)
    
    // It should have the smartDots container
    const dotsContainer = keyA.querySelector('div')
    expect(dotsContainer).toBeDefined()
    expect(dotsContainer.className).toMatch(/smartDots/)
    
    // And 5 dots, with index 1 (the 'A' in 'tasty') being 'dotTried'
    const dots = dotsContainer.querySelectorAll('span')
    expect(dots.length).toBe(5)
    expect(dots[1].className).toMatch(/dotTried/)
    expect(dots[0].className).not.toMatch(/dotTried/)
  })

  it('calls onChar when a letter key is clicked', () => {
    const onCharMock = vi.fn()
    const { getByText } = render(
      <Keyboard 
        guesses={[]} 
        word="apple" 
        onChar={onCharMock}
        onDelete={() => {}}
        onEnter={() => {}}
      />
    )
    
    fireEvent.click(getByText('K'))
    expect(onCharMock).toHaveBeenCalledWith('K')
  })
})
