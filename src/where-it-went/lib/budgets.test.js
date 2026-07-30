import { describe, it, expect } from 'vitest';
import {
  getBudgetWindow,
  previousWindow,
  spentInWindow,
  computeCarry,
  computeBudgetStatus,
  computeAllBudgets,
  normalizePeriod,
  formatPeriodSuffix,
  monthlyEquivalent,
  MAX_CARRY_WINDOWS,
} from './budgets';

const cat = (over = {}) => ({
  id: 'c1', name: 'Insurance', type: 'Expense',
  budgetLimit: 300, budgetPeriod: 'Monthly', budgetAnchor: null, budgetRollover: false, ...over,
});

const tx = (date, amount, over = {}) => ({
  id: `t${date}${amount}`, description: 'x', date, amount,
  type: 'Expense', categoryId: 'c1', accountId: 'a1', ...over,
});

const now = new Date(2026, 6, 15); // 15 Jul 2026

describe('normalizePeriod', () => {
  it('defaults anything unrecognised to Monthly', () => {
    expect(normalizePeriod(undefined)).toBe('Monthly');
    expect(normalizePeriod('Weekly')).toBe('Monthly');
    expect(normalizePeriod('Yearly')).toBe('Yearly');
  });
});

describe('getBudgetWindow', () => {
  it('monthly is the calendar month containing now', () => {
    const w = getBudgetWindow(cat(), now);
    expect(w.start).toEqual(new Date(2026, 6, 1));
    expect(w.end).toEqual(new Date(2026, 7, 1));
    expect(w.label).toMatch(/2026/);
  });

  it('monthly ignores an anchor — a 6th-to-5th month would disagree with the rest of the app', () => {
    const w = getBudgetWindow(cat({ budgetAnchor: '2026-01-06' }), now);
    expect(w.start).toEqual(new Date(2026, 6, 1));
    expect(w.anchored).toBe(false);
  });

  it('unanchored quarterly falls on calendar quarters', () => {
    const w = getBudgetWindow(cat({ budgetPeriod: 'Quarterly' }), now);
    expect(w.start).toEqual(new Date(2026, 6, 1)); // Q3 starts in July
    expect(w.end).toEqual(new Date(2026, 9, 1));
    expect(w.label).toBe('Q3 2026');
  });

  it('unanchored yearly is the calendar year', () => {
    const w = getBudgetWindow(cat({ budgetPeriod: 'Yearly' }), now);
    expect(w.start).toEqual(new Date(2026, 0, 1));
    expect(w.end).toEqual(new Date(2027, 0, 1));
    expect(w.label).toBe('2026');
  });

  it('anchored yearly runs from the renewal month', () => {
    // "Insurance renews in March" — the window must be Mar 2026 → Feb 2027.
    const w = getBudgetWindow(cat({ budgetPeriod: 'Yearly', budgetAnchor: '2024-03-01' }), now);
    expect(w.start).toEqual(new Date(2026, 2, 1));
    expect(w.end).toEqual(new Date(2027, 2, 1));
    expect(w.label).toMatch(/Mar 2026/);
  });

  it('anchored quarterly counts in threes from the anchor month', () => {
    const w = getBudgetWindow(cat({ budgetPeriod: 'Quarterly', budgetAnchor: '2026-02-01' }), now);
    expect(w.start).toEqual(new Date(2026, 4, 1)); // Feb, May, Aug… → May window holds 15 Jul
    expect(w.end).toEqual(new Date(2026, 7, 1));
  });

  it('handles a date before the anchor without inverting the window', () => {
    // Floor division has to stay correct for negative elapsed months.
    const w = getBudgetWindow(cat({ budgetPeriod: 'Yearly', budgetAnchor: '2030-03-01' }), now);
    expect(w.start.getTime()).toBeLessThan(w.end.getTime());
    expect(w.start).toEqual(new Date(2026, 2, 1));
  });
});

describe('previousWindow', () => {
  it('steps back one month', () => {
    const w = previousWindow(cat(), getBudgetWindow(cat(), now));
    expect(w.start).toEqual(new Date(2026, 5, 1));
  });

  it('steps back one quarter', () => {
    const c = cat({ budgetPeriod: 'Quarterly' });
    const w = previousWindow(c, getBudgetWindow(c, now));
    expect(w.start).toEqual(new Date(2026, 3, 1));
  });

  it('steps back across a year boundary', () => {
    const c = cat({ budgetPeriod: 'Yearly' });
    const w = previousWindow(c, getBudgetWindow(c, now));
    expect(w.start).toEqual(new Date(2025, 0, 1));
  });
});

describe('spentInWindow', () => {
  const window = getBudgetWindow(cat(), now);

  it('counts only this category, this window, expenses only', () => {
    const txs = [
      tx('2026-07-02', 100),
      tx('2026-07-30', 50),
      tx('2026-06-30', 999),                          // previous window
      tx('2026-08-01', 999),                          // next window
      tx('2026-07-03', 999, { categoryId: 'other' }), // another category
      tx('2026-07-04', 999, { type: 'Income' }),      // income
      tx('2026-07-05', 999, { type: 'Transfer' }),    // transfer
    ];
    expect(spentInWindow(txs, 'c1', window)).toBe(150);
  });

  it('includes the first day and excludes the last (half-open range)', () => {
    expect(spentInWindow([tx('2026-07-01', 10)], 'c1', window)).toBe(10);
    expect(spentInWindow([tx('2026-08-01', 10)], 'c1', window)).toBe(0);
  });
});

describe('computeCarry', () => {
  it('is zero when rollover is off, however much was underspent', () => {
    expect(computeCarry(cat({ budgetRollover: false }), [tx('2026-06-01', 10)], now)).toBe(0);
  });

  it('carries unspent room forward', () => {
    // 300/month; June spent 100 → 200 carried into July.
    const c = cat({ budgetRollover: true });
    expect(computeCarry(c, [tx('2026-06-01', 100)], now)).toBe(200);
  });

  it('accumulates across several windows', () => {
    // May spent 100 (+200), June spent 50 (+250) → 450.
    const c = cat({ budgetRollover: true });
    expect(computeCarry(c, [tx('2026-05-01', 100), tx('2026-06-01', 50)], now)).toBe(450);
  });

  it('carries an overspend forward as a negative', () => {
    // June spent 500 against 300 → −200 into July. Money already gone can't be
    // un-spent, so a clean slate each window would quietly forgive it.
    const c = cat({ budgetRollover: true });
    expect(computeCarry(c, [tx('2026-06-01', 500)], now)).toBe(-200);
  });

  it('does not walk back before the first transaction', () => {
    // Only June has history, so exactly one prior window contributes.
    const c = cat({ budgetRollover: true });
    expect(computeCarry(c, [tx('2026-06-15', 300)], now)).toBe(0);
  });

  it('is bounded so a very old ledger cannot accumulate forever', () => {
    const c = cat({ budgetRollover: true });
    // A transaction 5 years back would otherwise contribute 60 windows.
    const carry = computeCarry(c, [tx('2021-01-01', 0)], now);
    expect(carry).toBeLessThanOrEqual(300 * MAX_CARRY_WINDOWS);
  });

  it('is zero without a positive limit', () => {
    expect(computeCarry(cat({ budgetRollover: true, budgetLimit: 0 }), [tx('2026-06-01', 10)], now)).toBe(0);
  });
});

describe('computeBudgetStatus', () => {
  it('measures against the base limit when rollover is off', () => {
    const status = computeBudgetStatus(cat(), [tx('2026-07-10', 150)], now);
    expect(status.effectiveLimit).toBe(300);
    expect(status.spent).toBe(150);
    expect(status.remaining).toBe(150);
    expect(status.percent).toBe(50);
    expect(status.isOver).toBe(false);
  });

  it('measures against the effective limit when rollover is on', () => {
    const c = cat({ budgetRollover: true });
    const status = computeBudgetStatus(c, [tx('2026-06-01', 100), tx('2026-07-10', 400)], now);
    expect(status.carry).toBe(200);
    expect(status.effectiveLimit).toBe(500);
    expect(status.spent).toBe(400);
    expect(status.isOver).toBe(false); // would have been "over" on the base 300
  });

  it('flags an overspend against the effective limit', () => {
    const status = computeBudgetStatus(cat(), [tx('2026-07-10', 400)], now);
    expect(status.isOver).toBe(true);
    expect(status.percent).toBe(100); // clamped, never past the end of the bar
  });

  it('never produces a negative or infinite percentage when carry wipes out the allowance', () => {
    const c = cat({ budgetRollover: true });
    const status = computeBudgetStatus(c, [tx('2026-06-01', 900), tx('2026-07-10', 10)], now);
    expect(status.effectiveLimit).toBeLessThanOrEqual(0);
    expect(status.percent).toBe(100);
    expect(Number.isFinite(status.percent)).toBe(true);
  });

  it('measures a yearly budget over the whole year, not the month', () => {
    const c = cat({ budgetPeriod: 'Yearly', budgetLimit: 6000 });
    const status = computeBudgetStatus(c, [tx('2026-02-01', 1000), tx('2026-07-01', 500)], now);
    expect(status.spent).toBe(1500);
    expect(status.window.label).toBe('2026');
  });

  it('reports days left in the window', () => {
    const status = computeBudgetStatus(cat(), [], now);
    expect(status.daysLeft).toBeGreaterThan(0);
    expect(status.daysLeft).toBeLessThanOrEqual(17);
  });
});

describe('computeAllBudgets', () => {
  it('skips categories with no limit and Income categories', () => {
    const categories = [
      cat({ id: 'c1', budgetLimit: 300 }),
      cat({ id: 'c2', budgetLimit: 0 }),
      cat({ id: 'c3', budgetLimit: 500, type: 'Income' }),
    ];
    expect(computeAllBudgets(categories, [], now).map(b => b.id)).toEqual(['c1']);
  });

  it('survives empty input', () => {
    expect(computeAllBudgets(null, null, now)).toEqual([]);
  });
});

describe('monthlyEquivalent', () => {
  it('leaves a Monthly budget unchanged', () => {
    const status = computeBudgetStatus(cat({ budgetPeriod: 'Monthly', budgetLimit: 300 }), [tx('2026-07-05', 100)], now);
    expect(monthlyEquivalent(status)).toEqual({ limit: 300, spent: 100 });
  });

  it('divides a Quarterly budget by 3', () => {
    const status = computeBudgetStatus(cat({ budgetPeriod: 'Quarterly', budgetLimit: 900 }), [tx('2026-07-05', 300)], now);
    expect(monthlyEquivalent(status)).toEqual({ limit: 300, spent: 100 });
  });

  it('divides a Yearly budget by 12', () => {
    const status = computeBudgetStatus(cat({ budgetPeriod: 'Yearly', budgetLimit: 4800 }), [tx('2026-07-05', 1200)], now);
    expect(monthlyEquivalent(status)).toEqual({ limit: 400, spent: 100 });
  });

  it('a monthly and a yearly category now contribute comparable shares to a combined total', () => {
    // Before this, summing raw limits mixed timescales: 500 (one month) plus
    // 6000 (one year) read as "6500", a number with no coherent meaning.
    const monthly = computeBudgetStatus(cat({ id: 'm', budgetPeriod: 'Monthly', budgetLimit: 500 }), [], now);
    const yearly = computeBudgetStatus(cat({ id: 'y', budgetPeriod: 'Yearly', budgetLimit: 6000 }), [], now);
    const totalLimit = monthlyEquivalent(monthly).limit + monthlyEquivalent(yearly).limit;
    expect(totalLimit).toBe(1000); // 500/month + (6000/12)/month, not 6500
  });
});

describe('formatPeriodSuffix', () => {
  it('phrases each period for a "per X" label', () => {
    expect(formatPeriodSuffix('Monthly')).toBe('month');
    expect(formatPeriodSuffix('Quarterly')).toBe('quarter');
    expect(formatPeriodSuffix('Yearly')).toBe('year');
  });
});
