/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest'
import { render, screen, cleanup, within } from '@testing-library/react'
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

  describe('WATCHLIST panel', () => {
    const now = Date.now()
    const comingSoonNear = {
      id: 'cs1', title: 'Sooner Game', releaseStatus: 'Coming Soon', year: new Date().getFullYear(),
      releaseDate: 'Q1', tags: [], createdTime: '2026-01-01T00:00:00.000Z'
    }
    const comingSoonFar = {
      id: 'cs2', title: 'Later Game', releaseStatus: 'Coming Soon', year: new Date().getFullYear() + 2,
      tags: [], createdTime: '2026-01-01T00:00:00.000Z'
    }
    const recentlyReleased = {
      id: 'r1', title: 'Just Out', releaseStatus: 'Released',
      releasedAt: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(), tags: []
    }
    const ignored = { id: 'ig1', title: 'Skipped', releaseStatus: 'Ignored', tags: [] }
    const watchlistGames = [comingSoonNear, comingSoonFar, recentlyReleased, ignored]

    it('renders TRACKED, EXPECTED THIS YEAR, RECENTLY RELEASED and IGNORED counts, all independent of the collection stats', () => {
      render(<StatsView games={mockGames} watchlistGames={watchlistGames} />)
      expect(screen.getByText('WATCHLIST')).toBeTruthy()
      expect(screen.getByText('TRACKED')).toBeTruthy()
      expect(screen.getByText('EXPECTED THIS YEAR')).toBeTruthy()
      expect(screen.getByText('RECENTLY RELEASED (365D)').closest('li').textContent).toContain('1')
      expect(screen.getByText('IGNORED').closest('li').textContent).toContain('1')
      // TRACKED = 2 Coming Soon games (near + far), independent of mockGames' 4.
      expect(screen.getByText('TRACKED').closest('li').textContent).toContain('2')
    })

    it('shows the soonest-expected Coming Soon game as NEXT UP, not just the first in the array', () => {
      render(<StatsView games={mockGames} watchlistGames={watchlistGames} />)
      expect(screen.getByText('NEXT UP')).toBeTruthy()
      expect(screen.getByText('Sooner Game')).toBeTruthy()
      expect(screen.queryByText('Later Game')).toBeNull() // only the soonest one is shown
    })

    it('omits the NEXT UP block entirely when there is nothing Coming Soon', () => {
      render(<StatsView games={mockGames} watchlistGames={[recentlyReleased, ignored]} />)
      expect(screen.queryByText('NEXT UP')).toBeNull()
    })

    it('adds a COMING SOON line to STATUS_MATRIX reflecting the watchlist count, without it affecting COMPLETED/PLAYING/etc.', () => {
      render(<StatsView games={mockGames} watchlistGames={watchlistGames} />)
      const statusMatrix = screen.getByText('STATUS_MATRIX').closest('.cd-panel')
      expect(within(statusMatrix).getByText('COMING SOON').closest('li').textContent).toContain('2')
      // The collection counts are unaffected — still computed from `games`, not `watchlistGames`.
      expect(within(statusMatrix).getByText('COMPLETED').closest('li').textContent).toContain('2')
    })

    it('defaults watchlistGames to empty (no crash, no WATCHLIST panel data) when the prop is omitted', () => {
      render(<StatsView games={mockGames} />)
      expect(screen.getByText('TRACKED').closest('li').textContent).toContain('0')
      expect(screen.queryByText('NEXT UP')).toBeNull()
    })
  })
})
