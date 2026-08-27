// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import SettingsModal from './SettingsModal.jsx';

/**
 * Settings is now only settings. The old "Venue health" list lived here until
 * it turned out to be a strict subset of what the Venues tab already showed
 * for every venue — see VenueList.test.jsx for where "is this venue okay?"
 * is answered now.
 */

beforeEach(() => localStorage.clear());
afterEach(cleanup);

const prefs = { theme: 'system', hideSoldOut: false, showIgnored: false, keepToday: false };

describe('SettingsModal — Notify', () => {
  it('turning it off just flips the pref, synchronously, no permission dance', () => {
    const onPrefs = vi.fn();
    render(
      <SettingsModal
        open
        prefs={{ ...prefs, notifyEnabled: true }}
        onPrefs={onPrefs}
        venues={[]}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText('Notify me when tickets open'));
    expect(onPrefs).toHaveBeenCalledWith(expect.objectContaining({ notifyEnabled: false }));
  });

  it('the second toggle only appears once notifications are on', () => {
    const { rerender } = render(
      <SettingsModal open prefs={prefs} onPrefs={vi.fn()} venues={[]} onClose={vi.fn()} onChanged={vi.fn()} />,
    );
    expect(screen.queryByLabelText(/Also notify about/)).toBeNull();
    rerender(
      <SettingsModal
        open
        prefs={{ ...prefs, notifyEnabled: true }}
        onPrefs={vi.fn()}
        venues={[]}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/Also notify about/)).toBeTruthy();
  });

  it('says so plainly when the browser has notifications blocked', () => {
    render(
      <SettingsModal
        open
        prefs={{ ...prefs, notifyEnabled: true }}
        onPrefs={vi.fn()}
        venues={[]}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );
    // happy-dom has no Notification global at all, which notificationPermission()
    // reads the same way a real "denied" browser would.
    expect(screen.getByText(/blocking notifications/i)).toBeTruthy();
  });

  it('seven taps on the hint reveals background-check diagnostics', async () => {
    render(<SettingsModal open prefs={prefs} onPrefs={vi.fn()} venues={[]} onClose={vi.fn()} onChanged={vi.fn()} />);
    const hint = screen.getByText('Local · best-effort · Chromium + installed app only');
    for (let i = 0; i < 7; i++) fireEvent.click(hint);
    await waitFor(() => expect(screen.getByText(/permission:/)).toBeTruthy());
  });

  it('Quiet hours only appears once notifications are already on', () => {
    const { rerender } = render(
      <SettingsModal
        open
        prefs={{ ...prefs, notifyEnabled: true }}
        onPrefs={vi.fn()}
        venues={[]}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/Quiet hours/)).toBeTruthy();
    rerender(<SettingsModal open prefs={prefs} onPrefs={vi.fn()} venues={[]} onClose={vi.fn()} onChanged={vi.fn()} />);
    expect(screen.queryByLabelText(/Quiet hours/)).toBeNull();
  });
});

describe('SettingsModal — Programme toggles added for gestures and density', () => {
  it('Swipe to Keep or Ignore and Compact list both flip their own pref', () => {
    const onPrefs = vi.fn();
    render(
      <SettingsModal
        open
        prefs={{ ...prefs, swipeEnabled: true, compactList: false }}
        onPrefs={onPrefs}
        venues={[]}
        onClose={vi.fn()}
        onChanged={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText('Swipe to Keep or Ignore'));
    expect(onPrefs).toHaveBeenCalledWith(expect.objectContaining({ swipeEnabled: false }));
    fireEvent.click(screen.getByLabelText('Compact list'));
    expect(onPrefs).toHaveBeenCalledWith(expect.objectContaining({ compactList: true }));
  });
});
