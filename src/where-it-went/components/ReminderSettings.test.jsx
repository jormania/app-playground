// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import ReminderSettings from './ReminderSettings';
import { enableReminders, unregisterPeriodicSync, writeReminderState, capabilities } from '../lib/reminders';

vi.mock('../lib/reminders', async (importOriginal) => ({
  ...(await importOriginal()),
  enableReminders: vi.fn(),
  unregisterPeriodicSync: vi.fn().mockResolvedValue(undefined),
  writeReminderState: vi.fn().mockResolvedValue(undefined),
  capabilities: vi.fn(),
  notificationPermission: vi.fn(() => 'default'),
}));

const data = { subscriptions: [], transactions: [] };

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  capabilities.mockReturnValue({ notifications: true, periodicSync: true, serviceWorker: true });
  enableReminders.mockResolvedValue('granted');
  writeReminderState.mockResolvedValue(undefined);
  unregisterPeriodicSync.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

describe('ReminderSettings', () => {
  it('starts off and turns on once permission is granted', async () => {
    render(<ReminderSettings data={data} leadDays={5} />);
    const toggle = screen.getByLabelText(/notify me about upcoming bills/i);
    expect(toggle.checked).toBe(false);

    fireEvent.click(toggle);
    await waitFor(() => expect(toggle.checked).toBe(true));
    expect(JSON.parse(localStorage.getItem('whereItWent_reminders_enabled'))).toBe(true);
  });

  it('re-mirrors the snapshot the moment it is switched on', async () => {
    // App's snapshot effect keys off the data, which this toggle doesn't touch.
    // Without an explicit re-mirror the worker keeps reading `enabled: false`
    // until the next reload and nothing ever fires.
    render(<ReminderSettings data={data} leadDays={7} />);
    fireEvent.click(screen.getByLabelText(/notify me about upcoming bills/i));

    await waitFor(() => expect(writeReminderState).toHaveBeenCalledWith(data, { enabled: true, leadDays: 7 }));
  });

  it('re-mirrors with enabled false when switched off', async () => {
    localStorage.setItem('whereItWent_reminders_enabled', 'true');
    render(<ReminderSettings data={data} leadDays={5} />);
    fireEvent.click(screen.getByLabelText(/notify me about upcoming bills/i));

    await waitFor(() => expect(writeReminderState).toHaveBeenCalledWith(data, { enabled: false, leadDays: 5 }));
    expect(unregisterPeriodicSync).toHaveBeenCalled();
  });

  it('stays off — and mirrors as off — when permission is refused', async () => {
    // A toggle sitting "on" while nothing can fire is worse than one that
    // refuses to move.
    enableReminders.mockResolvedValue('denied');
    render(<ReminderSettings data={data} leadDays={5} />);
    const toggle = screen.getByLabelText(/notify me about upcoming bills/i);

    fireEvent.click(toggle);
    await waitFor(() => expect(writeReminderState).toHaveBeenCalledWith(data, { enabled: false, leadDays: 5 }));
    expect(toggle.checked).toBe(false);
    expect(await screen.findByText(/blocked for this site/i)).toBeDefined();
  });

  it('explains itself when the browser cannot show notifications at all', () => {
    capabilities.mockReturnValue({ notifications: false, periodicSync: false, serviceWorker: false });
    render(<ReminderSettings data={data} leadDays={5} />);
    expect(screen.getByLabelText(/notify me about upcoming bills/i).disabled).toBe(true);
    expect(screen.getByText(/cannot show notifications/i)).toBeDefined();
  });

  it('warns that background wake-ups need an installed app', () => {
    capabilities.mockReturnValue({ notifications: true, periodicSync: false, serviceWorker: true });
    render(<ReminderSettings data={data} leadDays={5} />);
    expect(screen.getByText(/installed app on Chromium/i)).toBeDefined();
  });
});
