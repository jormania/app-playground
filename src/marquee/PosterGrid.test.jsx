// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import PosterGrid from './PosterGrid.jsx';
import { toProductions, byDate, changedKeyMap } from './programme.js';

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

describe('PosterGrid', () => {
  it('renders one tile per production, grouped under a date heading', () => {
    const days = byDate(toProductions([event(), event({ key: 'k2', title: 'Solaris', date: '2026-09-24' })]));
    render(<PosterGrid days={days} triage={{}} changedKeys={new Map()} onKeep={() => {}} onIgnore={() => {}} />);
    expect(screen.getByText('Tomcat')).toBeTruthy();
    expect(screen.getByText('Solaris')).toBeTruthy();
  });

  it('shows the sold-out band only once EVERY showing is sold out', () => {
    const soldOut = byDate(toProductions([event({ ticketState: 'sold-out' })]));
    const { rerender, container } = render(
      <PosterGrid days={soldOut} triage={{}} changedKeys={new Map()} onKeep={() => {}} onIgnore={() => {}} />,
    );
    expect(container.querySelector('.poster-tile__soldout')).toBeTruthy();

    const mixed = byDate(toProductions([
      event({ key: 'a', ticketState: 'sold-out' }),
      event({ key: 'b', ticketState: 'open', date: '2026-09-24' }),
    ]));
    rerender(<PosterGrid days={mixed} triage={{}} changedKeys={new Map()} onKeep={() => {}} onIgnore={() => {}} />);
    expect(container.querySelector('.poster-tile__soldout')).toBeNull();
  });

  it('clicking the frame keeps the first showing; clicking × ignores, without opening Keep', () => {
    const onKeep = vi.fn();
    const onIgnore = vi.fn();
    const days = byDate(toProductions([event()]));
    render(<PosterGrid days={days} triage={{}} changedKeys={new Map()} onKeep={onKeep} onIgnore={onIgnore} />);

    fireEvent.click(screen.getByTitle('Keep Tomcat'));
    expect(onKeep).toHaveBeenCalledTimes(1);
    expect(onIgnore).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Ignore Tomcat' }));
    expect(onIgnore).toHaveBeenCalledTimes(1);
    expect(onKeep).toHaveBeenCalledTimes(1);
  });

  it('carries the same change badge the list view uses', () => {
    const days = byDate(toProductions([event()]));
    const changedKeys = changedKeyMap([{ kind: 'tickets-opened', key: 'k' }]);
    const { container } = render(
      <PosterGrid days={days} triage={{}} changedKeys={changedKeys} onKeep={() => {}} onIgnore={() => {}} />,
    );
    expect(container.querySelector('.poster-tile--changed-tickets-opened')).toBeTruthy();
    expect(screen.getByText('tickets on sale')).toBeTruthy();
  });
});
