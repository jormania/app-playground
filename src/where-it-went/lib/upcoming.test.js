import { describe, it, expect } from 'vitest';
import {
  getUpcomingBills,
  billsWithinLeadTime,
  sumBills,
  formatDaysUntil,
  isSnoozed,
  getUpcomingTransactions,
  DEFAULT_HORIZON_DAYS,
} from './upcoming';

const sub = (over = {}) => ({
  id: 's1', name: 'Netflix', amount: 60, type: 'Expense',
  dayOfMonth: 5, categoryId: 'c1', accountId: 'a1', active: true,
  lastProcessed: null, ...over,
});

// 15 Jul 2026, local midnight — same convention as useSubscriptionsEngine.test.js.
const today = new Date(2026, 6, 15);

describe('getUpcomingBills', () => {
  it('returns a charge due later this month', () => {
    const bills = getUpcomingBills([sub({ dayOfMonth: 22 })], [], { today });
    expect(bills.map(b => b.dueDate)).toEqual(['2026-07-22']);
    expect(bills[0].daysUntil).toBe(7);
  });

  it('rolls into next month once this month\'s day has passed', () => {
    const bills = getUpcomingBills([sub({ dayOfMonth: 5 })], [], { today });
    expect(bills.map(b => b.dueDate)).toEqual(['2026-08-05']);
  });

  it('excludes a charge due today — that one belongs to the posting engine', () => {
    // The engine posts everything with dueDate <= today. Counting it here too
    // would show a bill as "upcoming" at the same moment it gets written to
    // the ledger.
    // 40-day horizon so next month's occurrence is in range and this test is
    // about the today-exclusion alone, not the horizon edge.
    const bills = getUpcomingBills([sub({ dayOfMonth: 15 })], [], { today, horizonDays: 40 });
    expect(bills.map(b => b.dueDate)).toEqual(['2026-08-15']);
    expect(bills.map(b => b.dueDate)).not.toContain('2026-07-15');
  });

  it('excludes inactive subscriptions', () => {
    expect(getUpcomingBills([sub({ dayOfMonth: 22, active: false })], [], { today })).toEqual([]);
  });

  it('treats a missing `active` flag as active, matching the Notion default', () => {
    const bills = getUpcomingBills([sub({ dayOfMonth: 22, active: undefined })], [], { today });
    expect(bills).toHaveLength(1);
  });

  it('clamps day 31 to the real end of a short month', () => {
    // September has 30 days; without clamping this would land on 1 Oct.
    const bills = getUpcomingBills([sub({ dayOfMonth: 31 })], [], {
      today: new Date(2026, 8, 10), horizonDays: 30,
    });
    expect(bills.map(b => b.dueDate)).toEqual(['2026-09-30']);
  });

  it('includes a bill landing exactly on the horizon boundary', () => {
    const bills = getUpcomingBills([sub({ dayOfMonth: 14 })], [], { today, horizonDays: 30 });
    expect(bills.map(b => b.dueDate)).toEqual(['2026-08-14']); // 30 days out exactly
  });

  it('excludes a bill one day past the horizon', () => {
    const bills = getUpcomingBills([sub({ dayOfMonth: 15 })], [], { today, horizonDays: 30 });
    expect(bills).toEqual([]); // 2026-08-15 is 31 days out
  });

  it('returns one entry per occurrence over a long horizon', () => {
    // The forecast leans on this: three months of a monthly bill is three rows.
    const bills = getUpcomingBills([sub({ dayOfMonth: 5 })], [], { today, horizonDays: 90 });
    expect(bills.map(b => b.dueDate)).toEqual(['2026-08-05', '2026-09-05', '2026-10-05']);
  });

  it('sorts soonest-first across subscriptions, breaking ties by name', () => {
    const bills = getUpcomingBills([
      sub({ id: 's1', name: 'Spotify', dayOfMonth: 22 }),
      sub({ id: 's2', name: 'Gym', dayOfMonth: 18 }),
      sub({ id: 's3', name: 'Adobe', dayOfMonth: 22 }),
    ], [], { today });
    expect(bills.map(b => b.sub.name)).toEqual(['Gym', 'Adobe', 'Spotify']);
  });

  it('flags an occurrence the ledger already contains', () => {
    const transactions = [{ id: 't1', description: 'Netflix', amount: 60, date: '2026-08-05' }];
    const bills = getUpcomingBills([sub({ dayOfMonth: 5 })], transactions, { today });
    expect(bills[0].alreadyPosted).toBe(true);
  });

  it('does not flag a same-name charge in a different month', () => {
    const transactions = [{ id: 't1', description: 'Netflix', amount: 60, date: '2026-07-05' }];
    const bills = getUpcomingBills([sub({ dayOfMonth: 5 })], transactions, { today });
    expect(bills[0].alreadyPosted).toBe(false);
  });

  it('survives empty and missing inputs', () => {
    expect(getUpcomingBills(null, null, { today })).toEqual([]);
    expect(getUpcomingBills([], [], { today })).toEqual([]);
    expect(getUpcomingBills([sub()], [], { today, horizonDays: 0 })).toEqual([]);
  });

  it('defaults to a 30-day horizon', () => {
    expect(DEFAULT_HORIZON_DAYS).toBe(30);
    const bills = getUpcomingBills([sub({ dayOfMonth: 14 })], [], { today });
    expect(bills).toHaveLength(1);
  });

  it('crosses a year boundary correctly', () => {
    const bills = getUpcomingBills([sub({ dayOfMonth: 3 })], [], {
      today: new Date(2026, 11, 20), horizonDays: 30,
    });
    expect(bills.map(b => b.dueDate)).toEqual(['2027-01-03']);
  });

  it('a yearly subscription only appears once, in its own month', () => {
    const bills = getUpcomingBills(
      [sub({ frequency: 'Yearly', monthOfYear: 9, dayOfMonth: 18 })],
      [], { today, horizonDays: 365 },
    );
    expect(bills.map(b => b.dueDate)).toEqual(['2026-09-18']);
  });

  it('a yearly subscription due earlier this year rolls to next year', () => {
    const bills = getUpcomingBills(
      [sub({ frequency: 'Yearly', monthOfYear: 3, dayOfMonth: 18 })],
      [], { today, horizonDays: 365 },
    );
    expect(bills.map(b => b.dueDate)).toEqual(['2027-03-18']);
  });
});

describe('billsWithinLeadTime', () => {
  const bills = getUpcomingBills([
    sub({ id: 's1', name: 'Gym', dayOfMonth: 18 }),   // 3 days out
    sub({ id: 's2', name: 'Spotify', dayOfMonth: 25 }), // 10 days out
  ], [], { today });

  it('keeps only bills inside the lead time', () => {
    expect(billsWithinLeadTime(bills, 5).map(b => b.sub.name)).toEqual(['Gym']);
  });

  it('drops occurrences already in the ledger — no nagging about a paid bill', () => {
    const posted = getUpcomingBills(
      [sub({ id: 's1', name: 'Gym', amount: 150, dayOfMonth: 18 })],
      [{ id: 't1', description: 'Gym', amount: 150, date: '2026-07-18' }],
      { today },
    );
    expect(billsWithinLeadTime(posted, 5)).toEqual([]);
  });

  it('returns nothing for a non-positive lead time', () => {
    expect(billsWithinLeadTime(bills, 0)).toEqual([]);
  });
});

describe('sumBills', () => {
  it('signs expenses negative and income positive', () => {
    const bills = getUpcomingBills([
      sub({ id: 's1', name: 'Rent', amount: 2400, dayOfMonth: 20, type: 'Expense' }),
      sub({ id: 's2', name: 'Salary', amount: 9000, dayOfMonth: 28, type: 'Income' }),
    ], [], { today });
    expect(sumBills(bills)).toBe(6600);
  });

  it('is zero for nothing', () => {
    expect(sumBills([])).toBe(0);
    expect(sumBills(null)).toBe(0);
  });
});

describe('formatDaysUntil', () => {
  it('phrases the near dates in words', () => {
    expect(formatDaysUntil(0)).toBe('today');
    expect(formatDaysUntil(1)).toBe('tomorrow');
    expect(formatDaysUntil(3)).toBe('in 3 days');
  });
});

describe('isSnoozed', () => {
  const now = new Date(2026, 6, 15, 12, 0, 0);

  it('is true while the deadline is in the future', () => {
    expect(isSnoozed(now.getTime() + 60_000, now)).toBe(true);
  });

  it('is false once the deadline has passed', () => {
    expect(isSnoozed(now.getTime() - 1, now)).toBe(false);
  });

  it('is false for a missing or corrupted value', () => {
    expect(isSnoozed(undefined, now)).toBe(false);
    expect(isSnoozed('not a number', now)).toBe(false);
  });
});

const tx = (over = {}) => ({
  id: 't1', description: 'Hotel stay', amount: 1500, type: 'Expense',
  categoryId: 'c-travel', date: '2026-08-01', ...over,
});

describe('getUpcomingTransactions', () => {
  it('surfaces a future-dated transaction within the horizon', () => {
    const result = getUpcomingTransactions([tx()], [], { today, horizonDays: 30 });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Hotel stay');
    expect(result[0].dueDate).toBe('2026-08-01');
    expect(result[0].daysUntil).toBe(17);
  });

  it('excludes a transaction dated today or in the past', () => {
    const result = getUpcomingTransactions([tx({ date: '2026-07-15' }), tx({ id: 't2', date: '2026-07-01' })], [], { today });
    expect(result).toEqual([]);
  });

  it('excludes a transaction past the horizon', () => {
    const result = getUpcomingTransactions([tx({ date: '2026-08-20' })], [], { today, horizonDays: 30 });
    expect(result).toEqual([]);
  });

  it('excludes Transfers — neither an expense nor income to bucket', () => {
    const result = getUpcomingTransactions([tx({ type: 'Transfer' })], [], { today, horizonDays: 30 });
    expect(result).toEqual([]);
  });

  it('never duplicates an occurrence a subscription already claims', () => {
    // Entering next month's rent by hand shouldn't show up twice: once
    // (correctly) greyed out under the subscription, and again as a
    // phantom unrelated one-off.
    const bills = getUpcomingBills(
      [{ id: 's1', name: 'Rent', amount: 2400, type: 'Expense', dayOfMonth: 5, active: true }],
      [{ id: 't1', description: 'Rent', amount: 2400, date: '2026-08-05' }],
      { today, horizonDays: 30 },
    );
    expect(bills[0].alreadyPosted).toBe(true);

    const result = getUpcomingTransactions(
      [{ id: 't1', description: 'Rent', amount: 2400, type: 'Expense', date: '2026-08-05' }],
      bills,
      { today, horizonDays: 30 },
    );
    expect(result).toEqual([]);
  });

  it('carries the foreign-currency context through, same as a transaction row', () => {
    const result = getUpcomingTransactions(
      [tx({ originalAmount: 300, originalCurrency: 'EUR' })], [], { today, horizonDays: 30 },
    );
    expect(result[0].originalAmount).toBe(300);
    expect(result[0].originalCurrency).toBe('EUR');
  });

  it('sorts soonest first', () => {
    const result = getUpcomingTransactions(
      [tx({ id: 't1', date: '2026-08-10' }), tx({ id: 't2', date: '2026-07-20' })],
      [], { today, horizonDays: 30 },
    );
    expect(result.map(r => r.id)).toEqual(['t2', 't1']);
  });
});
