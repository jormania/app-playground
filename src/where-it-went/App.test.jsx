// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import App from './App';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

beforeEach(() => {
  localStorage.clear();
});

describe('App — Transfers toggle clears a stale Transfer filter', () => {
  it('resets filterType back to All when Transfers is turned off while it was the active filter', async () => {
    // Demo mode avoids any Notion network calls; seed both the config and the
    // persisted UI state exactly as they'd be if the user had filtered to
    // Transfers before disabling the feature in Settings.
    localStorage.setItem('whereItWent_config', JSON.stringify({
      demoMode: true, theme: 'light', features: { budgeting: true, cashFlow: true, transfers: true }
    }));
    localStorage.setItem('whereItWent_ui_state', JSON.stringify({
      activeTab: 'transactions', period: 'this_month', filterType: 'Transfer', categoryFilter: 'All'
    }));

    render(<App />);

    // Sanity check: the Filter Sheet starts out offering Transfers, active.
    fireEvent.click((await screen.findAllByTitle(/filters active/i))[0]);
    expect(screen.getByRole('radio', { name: 'Transfers' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.keyDown(document, { key: 'Escape' }); // BottomSheet has no close button — Escape dismisses it

    // Go turn the feature off in Settings.
    fireEvent.click(screen.getByRole('button', { name: /^settings$/i }));
    const transfersToggle = screen.getByLabelText('Transfers');
    expect(transfersToggle.checked).toBe(true);
    fireEvent.click(transfersToggle);
    fireEvent.click(screen.getByText('Save Configuration'));

    // Saving here doesn't navigate away from Settings on its own — go back to
    // the ledger to check the filter indicator and Filter Sheet directly.
    fireEvent.click(screen.getByRole('button', { name: /^transactions$/i }));
    await waitFor(() => {
      expect(screen.queryByTitle(/filters active/i)).toBeNull();
    });
    fireEvent.click(screen.getAllByTitle('Filter')[0]);
    expect(screen.queryByRole('radio', { name: 'Transfers' })).toBeNull();
  });
});
