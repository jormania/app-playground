/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen , cleanup } from '@testing-library/react'
import { TimelineView } from './TimelineView'

// Mock IntersectionObserver
window.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

const mockGames = [
  {
    id: '1',
    title: 'Game 1',
    year: 1990,
    developer: 'Dev 1',
    status: 'Completed',
    tags: [],
    journal: ''
  },
  {
    id: '2',
    title: 'Game 2',
    year: 1995,
    developer: 'Dev 2',
    status: 'Backlog',
    tags: [],
    journal: ''
  }
]

import { afterEach } from 'vitest';

describe('TimelineView', () => {
  afterEach(() => cleanup());
  it('renders empty state correctly', () => {
    render(<TimelineView games={[]} onEdit={() => {}} onUpdateStatus={() => {}} />)
    expect(screen.getByText('> QUERY EXECUTED...')).toBeTruthy()
  })

  it('renders timeline with games', () => {
    render(<TimelineView games={mockGames} onEdit={() => {}} onUpdateStatus={() => {}} />)
    expect(screen.getByText('YEAR: 1990')).toBeTruthy()
    expect(screen.getByText('YEAR: 1995')).toBeTruthy()
    expect(screen.getByText('Game 1')).toBeTruthy()
    expect(screen.getByText('Game 2')).toBeTruthy()
  })
})
