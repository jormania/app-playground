// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Settings from './Settings';
import { installMemoryStorage } from './test-utils/memoryStorage';
import { JOURNAL_MODE_KEY } from './lib/useJournalMode';
import { ThemeProvider } from './lib/themeContext';

installMemoryStorage();

const kvSet = vi.fn();

vi.mock('../shared/notify/idbKv', () => ({
  createIdbKv: () => ({ get: vi.fn(), set: kvSet, del: vi.fn() }),
}));
vi.mock('../shared/notify/periodicSync', () => ({
  registerPeriodicSync: vi.fn(),
  unregisterPeriodicSync: vi.fn(),
}));
vi.mock('../shared/notify/permission', () => ({
  requestPermission: vi.fn(async () => 'granted'),
  capabilities: () => ({ notifications: true, periodicSync: true, permission: 'granted' }),
}));
vi.mock('./services/NotionService', async () => {
  const actual = await vi.importActual<typeof import('./services/NotionService')>('./services/NotionService');
  return { ...actual, fetchRecentReflections: vi.fn(async () => []) };
});

const noop = () => {};
const renderSettings = () =>
  render(
    <ThemeProvider>
      <Settings onClose={noop} onResetCycle={async () => {}} />
    </ThemeProvider>
  );

afterEach(cleanup);
beforeEach(() => {
  localStorage.clear();
  kvSet.mockClear();
});

describe('Settings — Full', () => {
  it('offers the mentor and both reminder times', async () => {
    localStorage.setItem('daily-stoic:reminder-enabled', 'true');
    renderSettings();

    expect(screen.getByText('The Socratic Mentor')).toBeTruthy();
    expect(screen.getByLabelText('Anthropic API Key')).toBeTruthy();
    expect(screen.getByText('Morning Prep Time')).toBeTruthy();
    expect(screen.getByText('Evening Review Time')).toBeTruthy();
    expect(screen.getByText('Morning & Evening Nudges')).toBeTruthy();
  });
});

describe('Settings — Lite', () => {
  beforeEach(() => localStorage.setItem(JOURNAL_MODE_KEY, 'lite'));

  it('hides the mentor entirely — Lite has nowhere to show it', () => {
    renderSettings();

    expect(screen.queryByText('The Socratic Mentor')).toBeNull();
    expect(screen.queryByLabelText('Anthropic API Key')).toBeNull();
    expect(screen.queryByText('Enable the mentor')).toBeNull();
  });

  it('reduces the nudges to an evening one', () => {
    localStorage.setItem('daily-stoic:reminder-enabled', 'true');
    renderSettings();

    expect(screen.getByText('Evening Nudge')).toBeTruthy();
    expect(screen.queryByText('Morning Prep Time')).toBeNull();
    expect(screen.getByText('Reminder Time')).toBeTruthy();
  });

  it('tells the service worker to skip the morning nudge', async () => {
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByText('Evening Nudge'));

    await waitFor(() => expect(kvSet).toHaveBeenCalled());
    const [key, state] = kvSet.mock.calls[0];
    expect(key).toBe('state');
    expect(state.morningEnabled).toBe(false);
    expect(state.enabled).toBe(true);
    // Picks Lite's evening wording in the service worker.
    expect(state.lite).toBe(true);
  });

  it('leaves the morning nudge on in Full', async () => {
    localStorage.setItem(JOURNAL_MODE_KEY, 'full');
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByText('Morning & Evening Nudges'));

    await waitFor(() => expect(kvSet).toHaveBeenCalled());
    expect(kvSet.mock.calls[0][1].morningEnabled).toBe(true);
    expect(kvSet.mock.calls[0][1].lite).toBe(false);
  });

  it('re-syncs the worker when the mode is toggled with reminders on', async () => {
    localStorage.setItem(JOURNAL_MODE_KEY, 'full');
    localStorage.setItem('daily-stoic:reminder-enabled', 'true');
    const user = userEvent.setup();
    renderSettings();

    await user.click(screen.getByText('Lite Practice'));

    await waitFor(() => expect(kvSet).toHaveBeenCalled());
    expect(kvSet.mock.calls[0][1].morningEnabled).toBe(false);
    expect(kvSet.mock.calls[0][1].lite).toBe(true);
  });
});
