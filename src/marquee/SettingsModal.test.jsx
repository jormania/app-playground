// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import SettingsModal from './SettingsModal.jsx';

/**
 * The venue health list is the one thing this modal shows that isn't a
 * setting: last checked, last result, current reader, per venue — data that
 * already lives in Notion but that nothing else in the app puts side by side.
 */

beforeEach(() => localStorage.clear());
afterEach(cleanup);

const prefs = { theme: 'system', hideSoldOut: false, showIgnored: false, keepToday: false };

const venue = (over = {}) => ({
  id: 'v1', name: 'Teatrul Excelsior', adapter: 'excelsior', status: 'active',
  lastChecked: null, lastResult: null, ...over,
});

describe('SettingsModal — venue health', () => {
  it('says there is nothing yet when there are no venues', () => {
    render(<SettingsModal open prefs={prefs} onPrefs={vi.fn()} venues={[]} onClose={vi.fn()} onChanged={vi.fn()} />);
    expect(screen.getByText(/no venues yet/i)).toBeTruthy();
  });

  it('shows each venue’s reader and last result', () => {
    render(
      <SettingsModal
        open
        prefs={prefs}
        onPrefs={vi.fn()}
        venues={[venue({ lastChecked: '2026-08-25', lastResult: '24 events · 1 sold out' })]}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );
    expect(screen.getByText('Teatrul Excelsior')).toBeTruthy();
    expect(screen.getByText(/Teatrul Excelsior reader|checked/i)).toBeTruthy();
    expect(screen.getByText('24 events · 1 sold out')).toBeTruthy();
  });

  it('marks a paused venue distinctly, and a never-checked one honestly', () => {
    render(
      <SettingsModal
        open
        prefs={prefs}
        onPrefs={vi.fn()}
        venues={[venue({ name: 'Club Control', status: 'paused' })]}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );
    expect(screen.getByText('paused')).toBeTruthy();
    expect(screen.getByText(/never checked/i)).toBeTruthy();
  });

  it('sorts the list by name regardless of the order venues were given in', () => {
    render(
      <SettingsModal
        open
        prefs={prefs}
        onPrefs={vi.fn()}
        venues={[venue({ id: '1', name: 'Zed' }), venue({ id: '2', name: 'Alpha' })]}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );
    const names = [...document.querySelectorAll('.health__name')].map((el) => el.textContent.trim());
    expect(names).toEqual(['Alpha', 'Zed']);
  });
});
