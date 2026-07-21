/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import { RandomGameModal } from './RandomGameModal'

const backlogGames = [
  { id: '1', title: 'Game One', developer: 'Dev A', year: 2001, tags: ['Sci-Fi'], coverUrl: '', rating: 4 },
  { id: '2', title: 'Game Two', developer: 'Dev B', year: 2002, tags: ['Comedy'], coverUrl: '', rating: null }
]

describe('RandomGameModal', () => {
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
})
