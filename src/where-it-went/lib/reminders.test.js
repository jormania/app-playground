// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import {
  computeReminderState,
  billsToNotify,
  billNotificationId,
  daysUntilDue,
  formatBillNotification,
  trimSentIds,
  SNAPSHOT_HORIZON_DAYS,
  MAX_SENT_IDS,
} from './reminders';

const now = new Date(2026, 6, 15); // 15 Jul 2026

const sub = (over = {}) => ({
  id: 's1', name: 'Netflix', amount: 60, type: 'Expense',
  dayOfMonth: 18, categoryId: 'c1', accountId: 'a1', active: true, ...over,
});

describe('daysUntilDue', () => {
  it('counts whole local days', () => {
    expect(daysUntilDue('2026-07-18', now)).toBe(3);
    expect(daysUntilDue('2026-07-15', now)).toBe(0);
  });

  it('is negative for a past date', () => {
    expect(daysUntilDue('2026-07-10', now)).toBe(-5);
  });

  it('is null for anything unparseable', () => {
    expect(daysUntilDue('', now)).toBeNull();
    expect(daysUntilDue('not-a-date', now)).toBeNull();
  });
});

describe('billNotificationId', () => {
  it('is one id per subscription per due date', () => {
    const a = billNotificationId({ sub: { id: 's1' }, dueDate: '2026-07-18' });
    const b = billNotificationId({ sub: { id: 's1' }, dueDate: '2026-08-18' });
    expect(a).toBe('s1:2026-07-18');
    expect(a).not.toBe(b);
  });
});

describe('computeReminderState', () => {
  it('flattens bills to plain data the worker can read without a build step', () => {
    const state = computeReminderState({ subscriptions: [sub()], transactions: [] }, { enabled: true, now });
    expect(state.enabled).toBe(true);
    expect(state.bills[0]).toEqual({
      id: 's1:2026-07-18', name: 'Netflix', amount: 60, type: 'Expense', dueDate: '2026-07-18',
    });
  });

  it('carries a wider horizon than the lead time, so the snapshot survives between wakes', () => {
    // The worker may not run for days; a 5-day snapshot would be empty by then.
    const state = computeReminderState(
      { subscriptions: [sub({ dayOfMonth: 10 })], transactions: [] },
      { enabled: true, leadDays: 5, now },
    );
    expect(SNAPSHOT_HORIZON_DAYS).toBeGreaterThan(5);
    expect(state.bills.map(b => b.dueDate)).toContain('2026-08-10'); // 26 days out
  });

  it('drops occurrences already in the ledger, matching the in-app banner', () => {
    const transactions = [{ id: 't1', description: 'Netflix', amount: 60, date: '2026-07-18' }];
    const state = computeReminderState({ subscriptions: [sub()], transactions }, { enabled: true, now });
    expect(state.bills.map(b => b.dueDate)).not.toContain('2026-07-18');
  });

  it('defaults to disabled', () => {
    expect(computeReminderState({ subscriptions: [sub()], transactions: [] }, { now }).enabled).toBe(false);
  });

  it('survives empty data', () => {
    const state = computeReminderState({}, { enabled: true, now });
    expect(state.bills).toEqual([]);
  });
});

describe('billsToNotify', () => {
  const state = computeReminderState(
    { subscriptions: [sub({ id: 's1', name: 'Netflix', dayOfMonth: 18 }), sub({ id: 's2', name: 'Spotify', dayOfMonth: 28 })], transactions: [] },
    { enabled: true, leadDays: 5, now },
  );

  it('fires only for bills inside the lead time', () => {
    expect(billsToNotify(state, [], now).map(b => b.name)).toEqual(['Netflix']);
  });

  it('never fires twice for the same occurrence', () => {
    expect(billsToNotify(state, ['s1:2026-07-18'], now)).toEqual([]);
  });

  it('still fires for the next month of the same subscription', () => {
    // The guard is per occurrence, not per subscription.
    const later = new Date(2026, 7, 14); // 14 Aug — Netflix due the 18th again
    expect(billsToNotify(state, ['s1:2026-07-18'], later).map(b => b.id)).toContain('s1:2026-08-18');
  });

  it('goes quiet entirely when disabled', () => {
    expect(billsToNotify({ ...state, enabled: false }, [], now)).toEqual([]);
  });

  it('ignores a bill whose date has already passed', () => {
    // Past-due is the posting engine's business, not a reminder's.
    const past = new Date(2026, 6, 25);
    expect(billsToNotify(state, [], past).map(b => b.id)).not.toContain('s1:2026-07-18');
  });

  it('survives a missing or malformed snapshot', () => {
    expect(billsToNotify(null, [], now)).toEqual([]);
    expect(billsToNotify({ enabled: true }, [], now)).toEqual([]);
  });
});

describe('trimSentIds', () => {
  it('leaves a short list alone', () => {
    expect(trimSentIds(['a', 'b'])).toEqual(['a', 'b']);
  });

  it('keeps the newest once the cap is passed', () => {
    const ids = Array.from({ length: MAX_SENT_IDS + 10 }, (_, i) => `id${i}`);
    const trimmed = trimSentIds(ids);
    expect(trimmed).toHaveLength(MAX_SENT_IDS);
    expect(trimmed[trimmed.length - 1]).toBe(`id${MAX_SENT_IDS + 9}`);
  });

  it('handles junk input', () => {
    expect(trimSentIds(null)).toEqual([]);
  });
});

describe('formatBillNotification', () => {
  it('phrases the near dates in words', () => {
    const bill = { name: 'Rent', amount: 2400, dueDate: '2026-07-16', type: 'Expense' };
    expect(formatBillNotification(bill, now)).toBe('Rent · −2,400.00 L due tomorrow');
    expect(formatBillNotification({ ...bill, dueDate: '2026-07-15' }, now)).toMatch(/due today$/);
    expect(formatBillNotification({ ...bill, dueDate: '2026-07-18' }, now)).toMatch(/due in 3 days$/);
  });

  it('signs income differently — rent collected as a landlord is not an expense', () => {
    const bill = { name: 'Tenant Rent', amount: 2400, dueDate: '2026-07-16', type: 'Income' };
    expect(formatBillNotification(bill, now)).toBe('Tenant Rent · +2,400.00 L due tomorrow');
  });
});
