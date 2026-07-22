/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { RandomGameModal } from './RandomGameModal'

const backlogGames = [
  { id: '1', title: 'Game One', developer: 'Dev A', year: 2001, tags: ['Sci-Fi'], coverUrl: '', rating: 4 },
  { id: '2', title: 'Game Two', developer: 'Dev B', year: 2002, tags: ['Comedy'], coverUrl: '', rating: null }
]

describe('RandomGameModal', () => {
  beforeEach(() => localStorage.clear())

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('shows the empty-backlog directive when there are no candidates', () => {
    render(<RandomGameModal backlogGames={[]} onClose={() => {}} onUpdateStatus={() => {}} />)
    expect(screen.getByText(/NO GAMES FOUND IN BACKLOG/)).toBeTruthy()
  })

  it('settles on a game and begins a playthrough, preserving any existing rating', async () => {
    vi.useFakeTimers()
    const onUpdateStatus = vi.fn()
    const onClose = vi.fn()
    render(<RandomGameModal backlogGames={backlogGames} onClose={onClose} onUpdateStatus={onUpdateStatus} />)

    // Fast-forward through the 15-tick roll animation (100ms each).
    await act(async () => { vi.advanceTimersByTime(1600) })

    const beginBtn = screen.getByText('[BEGIN PLAYTHROUGH]')
    expect(beginBtn.disabled).toBe(false)

    fireEvent.click(beginBtn)

    expect(onUpdateStatus).toHaveBeenCalledTimes(1)
    const [id, status, rating] = onUpdateStatus.mock.calls[0]
    expect(backlogGames.map(g => g.id)).toContain(id)
    expect(status).toBe('Playing')
    // Must be either the settled game's real rating or null — never a
    // hardcoded 0, which would render as an invalid rating on a 1-5 scale.
    const settledGame = backlogGames.find(g => g.id === id)
    expect(rating).toBe(settledGame.rating ?? null)
    expect(rating).not.toBe(0)

    expect(onClose).toHaveBeenCalled()
  })

  it('does not show a weighting badge when explicitly set to uniform', () => {
    localStorage.setItem('cd_random_weight', 'uniform')
    render(<RandomGameModal backlogGames={backlogGames} onClose={() => {}} onUpdateStatus={() => {}} />)
    expect(screen.queryByText(/FAVORING/)).toBeNull()
  })

  it('shows the active weighting mode from Settings when non-uniform', () => {
    localStorage.setItem('cd_random_weight', 'oldest')
    render(<RandomGameModal backlogGames={backlogGames} onClose={() => {}} onUpdateStatus={() => {}} />)
    expect(screen.getByText('FAVORING OLDEST BACKLOG')).toBeTruthy()
  })

  describe('taste mode (the R2 default)', () => {
    it('defaults to taste mode with no Settings value saved yet, cold-starting to uniform under 3 ratings', () => {
      render(<RandomGameModal backlogGames={backlogGames} onClose={() => {}} onUpdateStatus={() => {}} />)
      expect(screen.getByText('FAVORING YOUR TASTE (COLD START — UNIFORM)')).toBeTruthy()
    })

    it('shows the plain taste badge once at least 3 games are rated', () => {
      const allGames = [
        { id: 'a', rating: 5, tags: ['Noir'], developer: 'X' },
        { id: 'b', rating: 4, tags: ['Noir'], developer: 'X' },
        { id: 'c', rating: 3, tags: ['Comedy'], developer: 'Y' }
      ]
      render(<RandomGameModal backlogGames={backlogGames} allGames={allGames} onClose={() => {}} onUpdateStatus={() => {}} />)
      expect(screen.getByText('FAVORING YOUR TASTE')).toBeTruthy()
    })
  })

  it('renders the settled cover as a real link to Steam when the game has an appId', async () => {
    vi.useFakeTimers()
    // A single-game pool makes the settled selection deterministic.
    const onlyGame = [{ id: '1', title: 'Game One', developer: 'Dev A', year: 2001, tags: [], coverUrl: '', rating: null, appId: 32340 }]
    render(<RandomGameModal backlogGames={onlyGame} onClose={() => {}} onUpdateStatus={() => {}} />)
    await act(async () => { vi.advanceTimersByTime(1600) })

    const link = document.querySelector('a.cd-random-cover-wrapper')
    expect(link).toBeTruthy()
    expect(link.getAttribute('href')).toBe('https://store.steampowered.com/app/32340')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('renders the settled cover as a plain non-link element when the game has no appId', async () => {
    vi.useFakeTimers()
    const onlyGame = [{ id: '1', title: 'Game One', developer: 'Dev A', year: 2001, tags: [], coverUrl: '', rating: null }]
    render(<RandomGameModal backlogGames={onlyGame} onClose={() => {}} onUpdateStatus={() => {}} />)
    await act(async () => { vi.advanceTimersByTime(1600) })

    expect(document.querySelector('a.cd-random-cover-wrapper')).toBeNull()
    expect(document.querySelector('div.cd-random-cover-wrapper')).toBeTruthy()
  })
})
