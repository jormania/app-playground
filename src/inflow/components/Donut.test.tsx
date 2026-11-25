// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Donut } from './Donut'

afterEach(cleanup)
const parts = [['a', 'Ana', 500], ['b', 'Bea', 300], ['c', 'Cai', 100], ['d', 'Dan', 50], ['e', 'Eli', 30], ['f', 'Flo', 20]]
  .map(([id, name, value]) => ({ id: id as string, name: name as string, value: value as number }))

describe('Donut', () => {
  it('shows the total, four named parts and the rest as "others"', () => {
    const { container } = render(<Donut parts={parts} caption="this year" label="Income by client" />)
    expect(screen.getByText('1,000 lei')).toBeTruthy()
    expect(screen.getByText('this year')).toBeTruthy()
    expect(screen.getByText('2 others')).toBeTruthy()
    expect(container.querySelectorAll('g circle')).toHaveLength(5)
  })

  it('reads a tapped slice in the centre, and the key narrows the list', () => {
    const pick = vi.fn()
    const { container } = render(<Donut parts={parts} caption="this year" label="x" onSelect={pick} />)
    fireEvent.click(container.querySelectorAll('g circle')[1])
    expect(container.querySelector('[aria-live] b')!.textContent).toBe('30%')
    expect(container.querySelector('[aria-live]')!.textContent).toContain('Bea')
    fireEvent.click(screen.getByRole('button', { name: /Ana/ }))
    expect(pick).toHaveBeenCalledWith('a')
    // "Other" folds several, so it is not a filter.
    expect(screen.queryByRole('button', { name: /2 others/ })).toBeNull()
  })

  it('says so when there is nothing', () => {
    render(<Donut parts={[]} caption="" label="x" />)
    expect(screen.getByText('Nothing here in this period.')).toBeTruthy()
  })
})
