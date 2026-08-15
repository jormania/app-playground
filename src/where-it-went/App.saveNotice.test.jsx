// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import App from './App';
import { SAVE_NOTICE_MS } from './components/SaveNotice';

/**
 * The save notice belongs to App rather than to the text box, because every
 * route into the ledger reports through it and because the loading gate under
 * `<main>` swaps the whole tab for a skeleton mid-refresh. These cover the two
 * halves of that: the + Add form gets a notice too, and the notice leaves on
 * its own without anyone touching it.
 */

afterEach(() => {
  cleanup();
  localStorage.clear();
});

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('whereItWent_config', JSON.stringify({
    demoMode: true, theme: 'light', features: {},
  }));
});

/** Fills the + Add form's required fields and submits it. */
function fillAndSave() {
  const dialog = screen.getByRole('dialog');
  fireEvent.change(dialog.querySelector('input[type="number"]'), { target: { value: '42' } });
  fireEvent.change(dialog.querySelector('input[type="text"]'), { target: { value: 'Coffee at Origo' } });
  for (const select of dialog.querySelectorAll('select')) {
    if (select.value) continue;
    const option = [...select.options].find(o => o.value);
    if (option) fireEvent.change(select, { target: { value: option.value } });
  }
  fireEvent.submit(dialog.querySelector('form'));
}

describe('App — the save notice', () => {
  it('reports a transaction added through the + Add form', async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: /add transaction/i }));

    fillAndSave();

    // Typed by hand, but the form still decided the account and the RON figure.
    const notice = await screen.findByRole('status');
    expect(notice.textContent).toContain('Coffee at Origo');
    expect(notice.textContent).toContain('Saved 42 L');
  });

  // Real timers, and the real four seconds: the dismissal *is* the behaviour
  // here, and faking the clock would only prove a timeout was scheduled
  // somewhere, not that the notice goes when it fires.
  it('leaves on its own, with no dismiss control to press', async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: /add transaction/i }));
    fillAndSave();

    await screen.findByRole('status');
    expect(screen.queryByRole('button', { name: 'Got it' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Change' })).toBeDefined();

    await waitFor(
      () => expect(screen.queryByRole('status')).toBeNull(),
      { timeout: SAVE_NOTICE_MS + 2000 },
    );
  });
});
