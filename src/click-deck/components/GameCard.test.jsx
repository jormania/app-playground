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
    render(<GameCard game={mockGame} onEdit={() => {}} onUpdateStatus={() => {}} />)
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

  it('exposes rating stars as keyboard-reachable, labeled buttons', () => {
    const completedGame = { ...mockGame, status: 'Completed', rating: 3 }
    const onUpdateStatus = vi.fn()
    render(<GameCard game={completedGame} onEdit={() => {}} onUpdateStatus={onUpdateStatus} />)

    const star4 = screen.getByLabelText('Rate 4 stars')
    expect(star4.tagName).toBe('BUTTON')
    expect(screen.getByLabelText('Rate 3 stars').getAttribute('aria-pressed')).toBe('true')
    expect(star4.getAttribute('aria-pressed')).toBe('false')

    fireEvent.click(star4)
    expect(onUpdateStatus).toHaveBeenCalledWith('123', 'Completed', 4)
  })

  it('shows the HLTB length in the meta row after the price, only when set', () => {
    render(<GameCard game={mockGame} onEdit={() => {}} onUpdateStatus={() => {}} />)
    expect(screen.queryByText(/⏱/)).toBeNull()

    cleanup()
    render(<GameCard game={{ ...mockGame, price: 5.99, lengthHours: 11.5 }} onEdit={() => {}} onUpdateStatus={() => {}} />)
    const priceEl = screen.getByText('$5.99')
    const lengthEl = screen.getByText('⏱ 11.5h')
    expect(lengthEl).toBeTruthy()
    // Comparing DOM position confirms it renders after price, not before.
    expect(priceEl.compareDocumentPosition(lengthEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('still shows the length segment when lengthHours is exactly 0', () => {
    // 0 is a real (if unusual) value, not "unset" — must still render, not be
    // treated as falsy and hidden.
    render(<GameCard game={{ ...mockGame, lengthHours: 0 }} onEdit={() => {}} onUpdateStatus={() => {}} />)
    expect(screen.getByText('⏱ 0h')).toBeTruthy()
  })

  it('shows a % SALE badge only when the game is discounted', () => {
    const { rerender } = render(<GameCard game={mockGame} onEdit={() => {}} onUpdateStatus={() => {}} />)
    expect(screen.queryByText('% SALE')).toBeNull()

    rerender(<GameCard game={{ ...mockGame, isDiscounted: true }} onEdit={() => {}} onUpdateStatus={() => {}} />)
    expect(screen.getByText('% SALE')).toBeTruthy()
  })

  it('applies a distinct color per status, including Abandoned', () => {
    const statuses = ['Backlog', 'Playing', 'Completed', 'Abandoned']
    const colors = statuses.map(status => {
      render(<GameCard game={{ ...mockGame, status }} onEdit={() => {}} onUpdateStatus={() => {}} />)
      const el = screen.getByText(`[${status}]`)
      const color = el.style.color
      cleanup()
      return color
    })
    // Every status should resolve to its own CSS variable, not all fall back
    // to the same default (the bug this guards: an undefined --cd-accent-red
    // silently rendering identically to the muted default).
    expect(new Set(colors).size).toBe(statuses.length)
    expect(colors[3]).toBe('var(--cd-status-abandoned)')
  })

  it('renders the cover as a real link to the Steam store page when an appId is present', () => {
    render(<GameCard game={{ ...mockGame, appId: 730820 }} onEdit={() => {}} onUpdateStatus={() => {}} />)
    const link = document.querySelector('a.cd-game-cover')
    expect(link).toBeTruthy()
    expect(link.getAttribute('href')).toBe('https://store.steampowered.com/app/730820')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('renders the cover as a plain non-link element when there is no appId', () => {
    render(<GameCard game={mockGame} onEdit={() => {}} onUpdateStatus={() => {}} />)
    expect(document.querySelector('a.cd-game-cover')).toBeNull()
    expect(document.querySelector('div.cd-game-cover')).toBeTruthy()
  })

  it('renders literal markdown emphasis inside a multi-segment rich-text journal as real formatting', () => {
    const richGame = {
      ...mockGame,
      journalRich: [
        { plain_text: 'A British comedy ', annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: 'default' } },
        { plain_text: '**classic**', annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: 'orange' } },
        { plain_text: ' worth playing.', annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: 'default' } }
      ]
    }
    render(<GameCard game={richGame} onEdit={() => {}} onUpdateStatus={() => {}} />)
    // The literal ** characters must not appear as visible text...
    expect(screen.queryByText(/\*\*classic\*\*/)).toBeNull()
    // ...and "classic" must render as actual bold emphasis instead.
    const bolded = screen.getByText('classic')
    expect(bolded.tagName).toBe('STRONG')
  })
})
