/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent , cleanup } from '@testing-library/react'
import { GameCard } from './GameCard'

const mockGame = {
  id: '123',
  title: 'Test Game',
  developer: 'Test Dev',
  status: 'Backlog',
  tags: ['Action', 'RPG'],
  journal: 'Great game',
  rating: null,
  coverUrl: 'http://test.com/cover.jpg'
}

import { afterEach } from 'vitest';

describe('GameCard', () => {
  afterEach(() => cleanup());
  it('renders correctly', () => {
    const { container } = render(<GameCard game={mockGame} onEdit={() => {}} onUpdateStatus={() => {}} />)
    expect(screen.getByText('Test Game')).toBeTruthy()
    expect(screen.getByText('Test Dev')).toBeTruthy()
    expect(screen.getByText('[Backlog]')).toBeTruthy()
    expect(screen.getByText('Action')).toBeTruthy()
    expect(screen.getByText('RPG')).toBeTruthy()
    expect(screen.getByText('Great game')).toBeTruthy()
  })

  it('calls onEdit when edit button is clicked', () => {
    const onEdit = vi.fn()
    render(<GameCard game={mockGame} onEdit={onEdit} onUpdateStatus={() => {}} />)
    fireEvent.click(screen.getByText('[E]DIT'))
    expect(onEdit).toHaveBeenCalledWith(mockGame)
  })

  it('renders rating stars when completed', () => {
    const completedGame = { ...mockGame, status: 'Completed', rating: 3 }
    render(<GameCard game={completedGame} onEdit={() => {}} onUpdateStatus={() => {}} />)
    const stars = screen.getAllByText(/★|☆/)
    expect(stars.length).toBe(5)
  })
})
