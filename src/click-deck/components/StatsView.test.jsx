/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { StatsView } from './StatsView'
import { afterEach } from 'vitest'

const mockGames = [
  {
    id: '1',
    title: 'Monkey Island',
    year: 1990,
    developer: 'LucasArts',
    status: 'Completed',
    rating: 5,
    tags: ['Comedy', 'Pirates']
  },
  {
    id: '2',
    title: 'Grim Fandango',
    year: 1998,
    developer: 'LucasArts',
    status: 'Completed',
    rating: 5,
    tags: ['Comedy', 'Noir']
  },
  {
    id: '3',
    title: 'Broken Age',
    year: 2014,
    developer: 'Double Fine',
    status: 'Playing',
    rating: null,
    tags: ['Comedy']
  },
  {
    id: '4',
    title: 'Bad Game',
    year: 2020,
    developer: 'Unknown',
    status: 'Abandoned',
    rating: 1,
    tags: ['Horror']
  }
]

describe('StatsView', () => {
  afterEach(() => cleanup());

  it('renders empty state correctly when no games provided', () => {
    render(<StatsView games={[]} />)
    expect(screen.getByText('INSUFFICIENT DATA TO COMPILE STATISTICS.')).toBeTruthy()
  })

  it('renders global stats correctly', () => {
    render(<StatsView games={mockGames} />)
    // 4 total games
    expect(screen.getByText('4')).toBeTruthy()
    // 2 completed, 1 playing, 0 backlog, 1 abandoned
    expect(screen.getByText('COMPLETED')).toBeTruthy()
    // Find the value associated with completed
    expect(screen.getAllByText('2')[0]).toBeTruthy()
  })

  it('shows "never synced" when no game has a priceUpdatedAt', () => {
    render(<StatsView games={mockGames} />)
    expect(screen.getByText('PRICES LAST SYNCED: NEVER')).toBeTruthy()
  })

  it('surfaces the most recent priceUpdatedAt across the collection', () => {
    const withSyncDates = [
      { ...mockGames[0], priceUpdatedAt: '2026-07-01T00:00:00.000Z' },
      { ...mockGames[1], priceUpdatedAt: '2026-07-20T00:00:00.000Z' }
    ]
    render(<StatsView games={withSyncDates} />)
    const expected = new Date('2026-07-20T00:00:00.000Z').toLocaleDateString()
    expect(screen.getByText(`PRICES LAST SYNCED: ${expected}`)).toBeTruthy()
  })
})
