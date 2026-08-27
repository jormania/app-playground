// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import VenueList from './VenueList.jsx';
import { troubleByVenue } from './programme.js';

afterEach(cleanup);

/**
 * "Is this venue okay?" used to be a separate read-only list in Settings
 * ("Venue health") that showed a strict SUBSET of what this screen already
 * shows — name, paused, reader, last checked, last result — while answering
 * the question no better: a failure reason landed in the same grey as
 * "24 events". The list is gone; the answer lives here, taken from the last
 * scan's own per-venue status rather than by parsing that text.
 */

const venue = (over = {}) => ({
  id: 'v1', name: 'Teatrul Excelsior', url: 'https://teatrul-excelsior.ro/program/',
  adapter: 'excelsior', status: 'active', category: 'play',
  lastChecked: '2026-08-26', lastResult: '24 events', config: null, notes: null, ...over,
});

const noop = () => {};
const props = { busyId: null, onTogglePause: noop, onEdit: noop, onRemove: noop };

describe('VenueList — everything the old Venue health list showed', () => {
  it('shows the reader, when it was last checked, and what that check found', () => {
    render(<VenueList {...props} venues={[venue()]} />);
    expect(screen.getByText('Teatrul Excelsior')).toBeTruthy();
    expect(screen.getByText(/Teatrul Excelsior reader|Last checked/)).toBeTruthy();
    expect(screen.getByText(/24 events/)).toBeTruthy();
  });

  it('marks a paused venue, and an unchecked one honestly', () => {
    render(<VenueList {...props} venues={[venue({ status: 'paused', lastChecked: null, lastResult: null })]} />);
    expect(screen.getByText('paused')).toBeTruthy();
    expect(screen.getByText(/Never checked/)).toBeTruthy();
  });

  it('says "no reader" when nothing can read the venue', () => {
    render(<VenueList {...props} venues={[venue({ adapter: null })]} />);
    expect(screen.getByText(/no reader/)).toBeTruthy();
  });
});

describe('VenueList — the trouble marker', () => {
  it('marks a venue the last check could not read, and colours its scan line', () => {
    const trouble = troubleByVenue([
      { venue: 'Teatrul Excelsior', status: 'parser-broken', detail: 'The markup has probably changed.' },
    ]);
    const { container } = render(<VenueList {...props} venues={[venue()]} troubleByVenue={trouble} />);
    expect(screen.getByText('not readable')).toBeTruthy();
    expect(container.querySelector('.venue__scan--trouble')).toBeTruthy();
  });

  it('distinguishes rate-limited from broken — throttled is not a breakage', () => {
    // MARQUEE.md §6's own rule: a 403 from a venue that answered moments ago
    // must never read as "this reader needs fixing".
    const trouble = troubleByVenue([{ venue: 'Teatrul Excelsior', status: 'throttled', detail: 'Rate-limited.' }]);
    render(<VenueList {...props} venues={[venue()]} troubleByVenue={trouble} />);
    expect(screen.getByText('rate-limited')).toBeTruthy();
    expect(screen.queryByText('not readable')).toBeNull();
  });

  it('marks nothing for a venue that answered, or one the check never covered', () => {
    const trouble = troubleByVenue([{ venue: 'Teatrul Excelsior', status: 'ok', detail: null }]);
    const { container, rerender } = render(
      <VenueList {...props} venues={[venue()]} troubleByVenue={trouble} />,
    );
    expect(container.querySelector('.venue__scan--trouble')).toBeNull();

    // Not in the scan at all (paused, or added since): unknown is not trouble.
    rerender(<VenueList {...props} venues={[venue()]} troubleByVenue={troubleByVenue([])} />);
    expect(container.querySelector('.venue__scan--trouble')).toBeNull();
  });

  it('defaults to no markers at all when no scan has run', () => {
    const { container } = render(<VenueList {...props} venues={[venue()]} />);
    expect(container.querySelector('.venue__scan--trouble')).toBeNull();
  });
});

describe('troubleByVenue', () => {
  it('keeps only the statuses that mean "could not read", with their reason', () => {
    const map = troubleByVenue([
      { venue: 'A', status: 'ok', detail: null },
      { venue: 'B', status: 'empty', detail: 'Nothing upcoming.' },
      { venue: 'C', status: 'throttled', detail: 'Rate-limited.' },
      { venue: 'D', status: 'parser-broken', detail: 'Markup changed.' },
      { venue: 'E', status: 'unreachable', detail: 'Answered 404.' },
    ]);
    expect([...map.keys()]).toEqual(['C', 'D', 'E']);
    expect(map.get('D')).toEqual({ status: 'parser-broken', detail: 'Markup changed.' });
  });

  it('is empty for no scan at all', () => {
    expect(troubleByVenue(undefined).size).toBe(0);
    expect(troubleByVenue([]).size).toBe(0);
  });
});
