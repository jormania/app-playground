/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { DiscountModal } from './DiscountModal'

const mockGames = [
  {
    id: '1', title: 'The Last Express', coverUrl: 'http://test.com/cover.jpg',
    price: 1.39, initialPrice: 6.99, discountPercent: 0.8, appId: 252710
  },
  {
    id: '2', title: 'Free Sample', coverUrl: '', price: 0, initialPrice: null,
    discountPercent: 0, appId: null
  }
]

describe('DiscountModal', () => {
  afterEach(() => cleanup())

  it('renders a discount card per game with rounded percent-off badges', () => {
    render(<DiscountModal games={mockGames} onClose={() => {}} />)
    expect(screen.getByText('ACTIVE_DISCOUNT')).toBeTruthy()
    expect(screen.getByText('The Last Express')).toBeTruthy()
    expect(screen.getByText('-80%')).toBeTruthy()
    expect(screen.getByText('$1.39')).toBeTruthy()
    expect(screen.getByText('$6.99')).toBeTruthy()
  })

  it('does not render a badge for a game with no discount', () => {
    render(<DiscountModal games={[mockGames[1]]} onClose={() => {}} />)
    expect(screen.queryByText(/^-\d+%$/)).toBeNull()
    expect(screen.getByText('FREE')).toBeTruthy()
  })

  it('calls onClose from the [X] button', () => {
    const onClose = vi.fn()
    render(<DiscountModal games={mockGames} onClose={onClose} />)
    fireEvent.click(screen.getByText('[X]'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when the overlay backdrop itself is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(<DiscountModal games={mockGames} onClose={onClose} />)
    fireEvent.click(container.querySelector('.cd-modal-overlay'))
    expect(onClose).toHaveBeenCalled()
  })
})
