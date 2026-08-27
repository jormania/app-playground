// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
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

  it('opens Settings, and its venue health list, without a scan', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(await screen.findByText('Venue health')).toBeTruthy();
    expect(screen.getByText('Appearance')).toBeTruthy();
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
});
