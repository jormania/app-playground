import { describe, it, expect } from 'vitest';
import { dueDateFor, getDueDates, isAlreadyPosted, planSubscriptionRun, MAX_BACKFILL_MONTHS } from './useSubscriptionsEngine';

describe('dueDateFor', () => {
  it('clamps day 31 into February instead of overflowing into March', () => {
    // new Date(2026, 1, 31) silently rolls over to 3 Mar 2026 — that used to post
    // February's rent in March, and then seed the *next* candidate from the
    // drifted date so the error compounded every month after.
    expect(dueDateFor(2026, 1, 31)).toBe('2026-02-28');
  });

  it('clamps into a leap February correctly', () => {
    expect(dueDateFor(2024, 1, 31)).toBe('2024-02-29');
  });

  it('passes an in-range day through unchanged', () => {
    expect(dueDateFor(2026, 6, 15)).toBe('2026-07-15');
  });
});

describe('getDueDates', () => {
  const today = new Date(2026, 6, 15); // 15 Jul 2026

  it('with no history, is due this month if the day has already passed', () => {
    expect(getDueDates(10, null, today)).toEqual(['2026-07-10']);
  });

  it('with no history, is not due yet if the day has not arrived', () => {
    expect(getDueDates(20, null, today)).toEqual([]);
  });

  it('backfills every missed month up to today using local YYYY-MM-DD strings', () => {
    // Never toISOString() — that shifted a 1st-of-month charge into the previous
    // month for any timezone east of UTC.
    const dates = getDueDates(1, '2026-04-01', today);
    expect(dates).toEqual(['2026-05-01', '2026-06-01', '2026-07-01']);
  });

  it('never backfills more than MAX_BACKFILL_MONTHS, even from a very stale lastProcessed', () => {
    const dates = getDueDates(1, '2000-01-01', today);
    expect(dates.length).toBeLessThanOrEqual(MAX_BACKFILL_MONTHS);
  });

  it('day 31 stays clamped across a backfill spanning February without drifting', () => {
    const dates = getDueDates(31, '2025-12-31', new Date(2026, 2, 31));
    expect(dates).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });
});

describe('isAlreadyPosted', () => {
  it('matches on description + amount within the same month', () => {
    const transactions = [{ description: 'Netflix', amount: 60, date: '2026-07-05' }];
    expect(isAlreadyPosted(transactions, { name: 'Netflix', amount: 60 }, '2026-07-01')).toBe(true);
    expect(isAlreadyPosted(transactions, { name: 'Netflix', amount: 60 }, '2026-08-01')).toBe(false);
    expect(isAlreadyPosted(transactions, { name: 'Netflix', amount: 61 }, '2026-07-01')).toBe(false);
  });
});

describe('planSubscriptionRun', () => {
  it('skips a charge that is already present in the ledger — the idempotency guard', () => {
    // Previously, a failed lastProcessed patch (only console.error'd) meant the
    // exact same charge could be posted again on the next launch.
    const data = {
      subscriptions: [{ id: 's1', name: 'Netflix', amount: 60, active: true, dayOfMonth: 5, lastProcessed: null }],
      transactions: [{ description: 'Netflix', amount: 60, date: '2026-07-05' }]
    };
    const [plan] = planSubscriptionRun(data, new Date(2026, 6, 20));
    expect(plan.toPost).toEqual([]);
    expect(plan.alreadyPresent).toEqual(['2026-07-05']);
  });

  it('ignores inactive subscriptions', () => {
    const data = {
      subscriptions: [{ id: 's1', name: 'Old Gym', amount: 100, active: false, dayOfMonth: 1, lastProcessed: null }],
      transactions: []
    };
    expect(planSubscriptionRun(data, new Date(2026, 6, 20))).toEqual([]);
  });
});
