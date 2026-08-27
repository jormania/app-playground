// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App.jsx';

// A smoke test over the whole app in demo mode — the one thing 3800 unit tests
// could not tell us, which is whether the pieces still mount together. The keep
// sheet has already crashed the app to a white screen once (MARQUEE.md §9.3),
// at the worst possible moment, and nothing here would have caught it.

afterEach(() => { cleanup(); localStorage.clear(); });

describe('Marquee, end to end in demo mode', () => {
  it('mounts on the programme with nothing checked yet', async () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Marquee', level: 1 })).toBeTruthy();
    expect(screen.getByText(/demo · not connected to Notion/)).toBeTruthy();
    expect(screen.getByText(/Nothing checked yet/)).toBeTruthy();
  });

  it('lists the demo venues, every one of them with a working reader', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /^Venues/ }));
    // Every demo venue must resolve to a reader the client knows about — the
    // shape of an adapter shipped on one side of the registry contract but not
    // the other. (The WRITE half of that drift is notion.test.js's job.)
    await waitFor(() => expect(screen.getByText(/read on each check/)).toBeTruthy());
    expect(screen.queryByText(/no reader/)).toBeNull();
    expect(screen.getByText('Teatrul Național București')).toBeTruthy();
    expect(screen.getByText('Teatrul Unteatru')).toBeTruthy();
  });

  it('opens Settings — which is now only settings, no venue list', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(await screen.findByText('Appearance')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Notify' })).toBeTruthy();
    // "Venue health" showed a strict subset of the Venues tab and moved there.
    expect(screen.queryByText('Venue health')).toBeNull();
  });

  it('opens the add-venue form and resolves a reader from a pasted URL', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /^Venues/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add venue' }));
    const url = await screen.findByLabelText(/Programme page URL/);
    fireEvent.change(url, { target: { value: 'https://www.mystage.ro/teatre/unteatru-2' } });
    expect(await screen.findByText(/Read by the mystage.ro venue page reader/)).toBeTruthy();
    // The URL leads: the name fills itself in rather than being typed.
    expect(screen.getByLabelText(/Venue name/).value).toBeTruthy();
  });

  it('keeping a showing offers Undo, and Undo actually reverses the save', async () => {
    // The app's only write, end to end: scan → keep → the toast that follows →
    // pressing Undo really archives the row rather than just closing the toast.
    const user = userEvent.setup();
    const event = {
      key: 'excelsior:2099-01-01T20:00:demo-show',
      venue: 'Teatrul Excelsior',
      title: 'Demo Show',
      date: '2099-01-01',
      time: '20:00',
      ticketState: 'open',
    };
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        scannedAt: new Date().toISOString(),
        venues: [{ venue: 'Teatrul Excelsior', status: 'ok', events: [event] }],
        events: [event],
      }),
    })));

    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Check venues' }));
    await screen.findByText('Demo Show');

    await user.click(screen.getByRole('button', { name: 'Keep' }));
    await screen.findByText('Keep in Wanderlist');
    await user.click(screen.getByRole('button', { name: 'Keep it' }));

    const toast = await screen.findByText(/Kept “Demo Show”\./);
    expect(toast).toBeTruthy();
    // Already reflected on the card, not just claimed by the toast.
    expect(await screen.findByText('in Wanderlist')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(screen.queryByText(/Kept “Demo Show”\./)).toBeNull());
    await waitFor(() => expect(screen.queryByText('in Wanderlist')).toBeNull());

    vi.unstubAllGlobals();
  });

  it('the layout toggle appears only where it does something', async () => {
    // Check venues and Settings are always actionable; the List/Posters
    // switch is not — with no programme on screen there is nothing to switch
    // between, and it used to render anyway (including over the Venues tab),
    // silently changing a preference with nothing to show for it.
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole('button', { name: 'Check venues' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Switch to/ })).toBeNull();

    await user.click(await screen.findByRole('button', { name: /^Venues/ }));
    expect(screen.queryByRole('button', { name: /Switch to/ })).toBeNull();
  });

  it('once a programme is on screen, the toggle switches layout and persists the choice', async () => {
    const user = userEvent.setup();
    const event = {
      key: 'excelsior:2099-01-01T20:00:demo-show',
      venue: 'Teatrul Excelsior',
      title: 'Demo Show',
      date: '2099-01-01',
      time: '20:00',
      ticketState: 'open',
    };
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        scannedAt: new Date().toISOString(),
        venues: [{ venue: 'Teatrul Excelsior', status: 'ok', events: [event] }],
        events: [event],
      }),
    })));

    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Check venues' }));
    await screen.findByText('Demo Show');

    await user.click(await screen.findByRole('button', { name: 'Switch to poster view' }));
    expect(await screen.findByRole('button', { name: 'Switch to list view' })).toBeTruthy();

    // Persisted, not just component state — the same prefs round trip every
    // other Settings toggle already uses.
    expect(JSON.parse(localStorage.getItem('marquee_prefs')).viewMode).toBe('posters');

    vi.unstubAllGlobals();
  });
});
