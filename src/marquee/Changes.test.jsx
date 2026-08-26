// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import Changes from './Changes.jsx';
import { toSnapshot, CHANGE } from './changes.js';

afterEach(cleanup);

const change = (over = {}) => ({
  kind: CHANGE.TICKETS_OPENED,
  key: 'k',
  venue: 'Teatrul Excelsior',
  title: 'Tomcat',
  date: '2026-09-23',
  time: '20:00',
  ...over,
});

const scanWith = (changes, over = {}) => ({
  scannedAt: '2026-08-26T09:00:00.000Z',
  hadSnapshot: true,
  changes,
  ...over,
});

describe('Changes', () => {
  it('renders nothing before a first scan', () => {
    const { container } = render(<Changes scan={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('says nothing when the first scan is still the baseline', () => {
    render(<Changes scan={{ hadSnapshot: false, changes: [] }} />);
    expect(screen.getByText(/this scan is the baseline/i)).toBeTruthy();
  });

  it('says nothing new, dated relative to the last check', () => {
    render(<Changes scan={scanWith([])} />);
    expect(screen.getByText(/nothing new since/i)).toBeTruthy();
  });

  it('lists each change and calls onOpen with it when clicked', () => {
    const onOpen = vi.fn();
    render(<Changes scan={scanWith([change()])} onOpen={onOpen} />);
    fireEvent.click(screen.getByText('Tomcat'));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ title: 'Tomcat' }));
  });

  describe('dismiss', () => {
    it('hides the whole panel once dismissed', () => {
      const { container, rerender } = render(<Changes scan={scanWith([change()])} dismissed={false} onDismiss={vi.fn()} />);
      expect(screen.getByText('Tomcat')).toBeTruthy();
      rerender(<Changes scan={scanWith([change()])} dismissed onDismiss={vi.fn()} />);
      expect(container.innerHTML).toBe('');
    });

    it('calls onDismiss rather than clearing itself — the parent owns when it reappears', () => {
      const onDismiss = vi.fn();
      render(<Changes scan={scanWith([change()])} dismissed={false} onDismiss={onDismiss} />);
      fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
      expect(onDismiss).toHaveBeenCalledTimes(1);
      // Nothing here decides visibility on its own — no state change without the
      // parent re-rendering with dismissed=true.
      expect(screen.getByText('Tomcat')).toBeTruthy();
    });

    it('offers no dismiss control when the parent doesn’t wire one up', () => {
      render(<Changes scan={scanWith([change()])} />);
      expect(screen.queryByRole('button', { name: /dismiss/i })).toBeNull();
    });
  });

  it('explains "gone from the programme" only when a cancellation is actually present', () => {
    render(<Changes scan={scanWith([change({ kind: CHANGE.NEW })])} />);
    expect(screen.queryByText(/usually a cancellation/i)).toBeNull();
    cleanup();
    render(<Changes scan={scanWith([change({ kind: CHANGE.CANCELLED })])} />);
    expect(screen.getByText(/usually a cancellation/i)).toBeTruthy();
  });
});

describe('snapshot round trip used by the tests above', () => {
  it('toSnapshot still shapes events the way these fixtures assume', () => {
    const snap = toSnapshot([{ key: 'k', title: 'Tomcat', date: '2026-09-23', venue: 'Teatrul Excelsior', ticketState: 'open' }])
    expect(snap.events.k).toMatchObject({ title: 'Tomcat' })
  })
})
