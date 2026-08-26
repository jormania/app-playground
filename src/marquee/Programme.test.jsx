// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import Programme from './Programme.jsx';
import { toProductions, byDate } from './programme.js';

afterEach(cleanup);

const event = (over = {}) => ({
  key: 'k',
  venue: 'Teatrul Excelsior',
  title: 'Tomcat',
  date: '2026-09-23',
  time: '20:00',
  ticketState: 'none',
  hall: null,
  link: null,
  image: null,
  price: null,
  ...over,
});

const scan = { scannedAt: '2026-08-26T09:00:00.000Z', hadSnapshot: true, changes: [], venues: [] };

const baseProps = {
  scan,
  triage: {},
  onKeep: () => {},
  onIgnore: () => {},
  onCategoryFilter: () => {},
  onVenueFilter: () => {},
  onHallFilter: () => {},
};

describe('Programme — the category → venue → hall filter tiers', () => {
  it('shows no filter row at all with one venue and nothing to group', () => {
    const days = byDate(toProductions([event()]))
    render(<Programme {...baseProps} days={days} venues={[{ name: 'Teatrul Excelsior', category: 'play' }]} />)
    expect(screen.queryByRole('button', { name: 'All' })).toBeNull()
  })

  it('falls back to one flat venue row when every active venue shares a category', () => {
    const venues = [{ name: 'Teatrul Excelsior', category: 'play' }, { name: 'Teatrul Național București', category: 'play' }]
    const days = byDate(toProductions([event(), event({ key: 'k2', venue: 'Teatrul Național București', title: 'Alt' })]))
    render(<Programme {...baseProps} days={days} venues={venues} categories={['play']} />)
    // One flat row: category chips never appear (only one category), venue chips do.
    expect(screen.getByRole('button', { name: 'Teatrul Excelsior' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Teatrul Național București' })).toBeTruthy()
  })

  it('reveals venue chips only once a category is picked, when more than one category is in play', () => {
    const venues = [{ name: 'Teatrul Excelsior', category: 'play' }, { name: 'Cinema Union', category: 'movie' }]
    const days = byDate(toProductions([event(), event({ key: 'k2', venue: 'Cinema Union', title: 'Film' })]))
    const onCategoryFilter = vi.fn()
    const { rerender } = render(
      <Programme {...baseProps} days={days} venues={venues} categories={['play', 'movie']} onCategoryFilter={onCategoryFilter} />,
    )
    expect(screen.getByRole('button', { name: 'Theatre' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cinema' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Teatrul Excelsior' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Theatre' }))
    expect(onCategoryFilter).toHaveBeenCalledWith('play')

    rerender(
      <Programme
        {...baseProps}
        days={days}
        venues={venues}
        categories={['play', 'movie']}
        categoryFilter="play"
        venuesInCategory={[{ name: 'Teatrul Excelsior', category: 'play' }]}
        onCategoryFilter={onCategoryFilter}
      />,
    )
    expect(screen.getByRole('button', { name: 'Teatrul Excelsior' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Cinema Union' })).toBeNull()
  })

  it('shows hall chips only when hallOptions carries more than one — a single-hall venue gets none', () => {
    const days = byDate(toProductions([event()]))
    const { rerender } = render(
      <Programme {...baseProps} days={days} venues={[{ name: 'Teatrul Excelsior', category: 'play' }]} hallOptions={[]} />,
    )
    expect(screen.queryByRole('button', { name: 'Sala Atelier' })).toBeNull()

    rerender(
      <Programme
        {...baseProps}
        days={days}
        venues={[{ name: 'Teatrul Național București', category: 'play' }]}
        venueFilter="Teatrul Național București"
        hallOptions={['Sala Atelier', 'Sala Studio']}
      />,
    )
    expect(screen.getByRole('button', { name: 'Sala Atelier' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sala Studio' })).toBeTruthy()
  })
})

describe('Programme — the poster slot renders for every card, cover or not', () => {
  it('shows the real cover when a reader returned one', () => {
    const days = byDate(toProductions([event({ image: 'https://example.com/poster.jpg' })]))
    const { container } = render(<Programme {...baseProps} days={days} venues={[{ name: 'Teatrul Excelsior', category: 'play' }]} />)
    const poster = container.querySelector('.prod__poster')
    expect(poster.classList.contains('prod__poster--placeholder')).toBe(false)
    expect(poster.querySelector('img')?.src).toBe('https://example.com/poster.jpg')
  })

  it('falls back to the placeholder outline when there is no cover — never a blank gap', () => {
    const days = byDate(toProductions([event({ image: null })]))
    const { container } = render(<Programme {...baseProps} days={days} venues={[{ name: 'Teatrul Excelsior', category: 'play' }]} />)
    const poster = container.querySelector('.prod__poster')
    expect(poster.classList.contains('prod__poster--placeholder')).toBe(true)
    expect(poster.querySelector('img')).toBeNull()
    expect(poster.querySelector('svg')).toBeTruthy()
  })

  it('falls back to the placeholder when a real cover URL fails to load', () => {
    const days = byDate(toProductions([event({ image: 'https://example.com/broken.jpg' })]))
    const { container } = render(<Programme {...baseProps} days={days} venues={[{ name: 'Teatrul Excelsior', category: 'play' }]} />)
    const img = container.querySelector('.prod__poster img')
    fireEvent.error(img)
    const poster = container.querySelector('.prod__poster')
    expect(poster.classList.contains('prod__poster--placeholder')).toBe(true)
    expect(poster.querySelector('img')).toBeNull()
  })
})
