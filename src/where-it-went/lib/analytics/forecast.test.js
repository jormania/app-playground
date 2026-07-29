import { describe, it, expect } from 'vitest';
import {
  projectCashFlow,
  summarizeForecast,
  median,
  isRecurringCharge,
  MIN_HISTORY_MONTHS,
} from './forecast';

// 15 Jul 2026 — the same anchor the rest of the date-sensitive suites use.
const now = new Date(2026, 6, 15);

const tx = (date, amount, over = {}) => ({
  id: `t${date}${amount}`, description: 'Groceries', date, amount,
  type: 'Expense', categoryId: 'c1', accountId: 'a1', tags: [], ...over,
});

/** Three complete trailing months (Apr/May/Jun) of discretionary spend. */
const history = (amounts = [1000, 1200, 1100]) => [
  tx('2026-04-10', amounts[0]),
  tx('2026-05-10', amounts[1]),
  tx('2026-06-10', amounts[2]),
];

const salary = {
  id: 's_inc', name: 'Salary', amount: 9000, type: 'Income',
  dayOfMonth: 28, categoryId: 'c_inc', accountId: 'a1', active: true,
};
const rent = {
  id: 's_rent', name: 'Rent', amount: 2400, type: 'Expense',
  dayOfMonth: 20, categoryId: 'c_house', accountId: 'a1', active: true,
};

describe('median', () => {
  it('takes the middle of an odd-length list', () => {
    expect(median([1, 100, 5])).toBe(5);
  });

  it('averages the middle two of an even-length list', () => {
    expect(median([1, 3, 5, 7])).toBe(4);
  });

  it('ignores non-finite values and is zero for nothing', () => {
    expect(median([])).toBe(0);
    expect(median([NaN, undefined, 4])).toBe(4);
  });

  it('is not dragged by a single outlier, unlike a mean', () => {
    // The whole reason the forecast uses a median: one holiday shouldn't
    // poison three months of projection (mean here would be 4,066).
    expect(median([1000, 1200, 11000])).toBe(1200);
  });
});

describe('isRecurringCharge', () => {
  const names = new Set(['netflix']);

  it('matches an auto-posted charge by its tag', () => {
    expect(isRecurringCharge({ description: 'Anything', tags: ['Subscription'] }, names)).toBe(true);
  });

  it('matches a hand-entered charge by name, which carries no tag', () => {
    // Without this the same charge counts as committed *and* discretionary,
    // doubling it in every projected month.
    expect(isRecurringCharge({ description: '  NETFLIX ', tags: [] }, names)).toBe(true);
  });

  it('leaves ordinary spending alone', () => {
    expect(isRecurringCharge({ description: 'Groceries', tags: [] }, names)).toBe(false);
  });
});

describe('projectCashFlow', () => {
  it('reports low confidence and no estimate below the history threshold', () => {
    const forecast = projectCashFlow({ transactions: [tx('2026-06-10', 1000)], subscriptions: [] }, { now });
    expect(forecast.monthsOfHistory).toBe(1);
    expect(forecast.hasHistory).toBe(false);
    expect(forecast.confidence).toBe('low');
    expect(forecast.basis.discretionaryMedian).toBe(0);
  });

  it('requires complete months — the current partial month never counts as history', () => {
    const forecast = projectCashFlow({
      transactions: [...history(), tx('2026-07-02', 500)], subscriptions: [],
    }, { now });
    expect(forecast.monthsOfHistory).toBe(MIN_HISTORY_MONTHS); // Apr/May/Jun, not Jul
  });

  it('projects the requested number of months', () => {
    const forecast = projectCashFlow({ transactions: history(), subscriptions: [] }, { now, horizonMonths: 3 });
    expect(forecast.months.map(m => m.monthKey)).toEqual(['2026-07', '2026-08', '2026-09']);
  });

  it('counts subscription charges as committed, separately from the estimate', () => {
    const forecast = projectCashFlow({
      transactions: history(), subscriptions: [salary, rent],
    }, { now, horizonMonths: 2 });

    const august = forecast.months[1];
    expect(august.committedIncome).toBe(9000);
    expect(august.committedExpense).toBe(2400);
    // Median of 1000/1200/1100, full month ahead.
    expect(august.estimatedExpense).toBe(1100);
    expect(august.net).toBe(9000 - 2400 - 1100);
  });

  it('prorates only the remaining part of the current month', () => {
    // 15 Jul: 17 of July's 31 days are still ahead (the 15th included).
    const forecast = projectCashFlow({ transactions: history(), subscriptions: [] }, { now, horizonMonths: 1 });
    expect(forecast.months[0].estimatedExpense).toBeCloseTo(1100 * (17 / 31), 6);
    expect(forecast.months[0].isCurrentMonth).toBe(true);
  });

  it('does not double-count a recurring charge that is also in the ledger', () => {
    // Netflix appears as a subscription *and* as posted history. It must feed
    // `committed` only, never the discretionary median.
    const netflix = { ...rent, id: 's_nf', name: 'Netflix', amount: 60, dayOfMonth: 20 };
    const withPosted = [
      ...history([1000, 1000, 1000]),
      tx('2026-04-20', 60, { description: 'Netflix' }),
      tx('2026-05-20', 60, { description: 'Netflix', tags: ['Subscription'] }),
      tx('2026-06-20', 60, { description: 'Netflix' }),
    ];
    const forecast = projectCashFlow({ transactions: withPosted, subscriptions: [netflix] }, { now, horizonMonths: 2 });
    expect(forecast.basis.discretionaryMedian).toBe(1000); // not 1,060
    expect(forecast.months[1].committedExpense).toBe(60);
  });

  it('excludes Transfers from the estimate entirely', () => {
    const withTransfer = [...history([1000, 1000, 1000]), tx('2026-05-11', 5000, { type: 'Transfer', categoryId: '' })];
    const forecast = projectCashFlow({ transactions: withTransfer, subscriptions: [] }, { now });
    expect(forecast.basis.discretionaryMedian).toBe(1000);
  });

  it('ignores inactive subscriptions', () => {
    const forecast = projectCashFlow({
      transactions: history(), subscriptions: [{ ...rent, active: false }],
    }, { now, horizonMonths: 2 });
    expect(forecast.months[1].committedExpense).toBe(0);
  });

  it('names the first month that runs short', () => {
    const bigRent = { ...rent, amount: 20000 };
    const forecast = projectCashFlow({
      transactions: history(), subscriptions: [salary, bigRent],
    }, { now, horizonMonths: 3 });
    expect(forecast.firstNegativeMonthKey).toBe('2026-07');
  });

  it('has no negative month when income comfortably covers everything', () => {
    const forecast = projectCashFlow({
      transactions: history(), subscriptions: [salary, rent],
    }, { now, horizonMonths: 3 });
    expect(forecast.firstNegativeMonthKey).toBeNull();
  });

  it('grades confidence by how much history there is', () => {
    const sixMonths = [
      tx('2026-01-10', 1000), tx('2026-02-10', 1000), tx('2026-03-10', 1000),
      tx('2026-04-10', 1000), tx('2026-05-10', 1000), tx('2026-06-10', 1000),
    ];
    expect(projectCashFlow({ transactions: sixMonths, subscriptions: [] }, { now }).confidence).toBe('high');
    expect(projectCashFlow({ transactions: history(), subscriptions: [] }, { now }).confidence).toBe('medium');
  });

  it('survives empty input without throwing', () => {
    const forecast = projectCashFlow({}, { now });
    expect(forecast.months).toHaveLength(3);
    expect(forecast.months.every(m => m.net === 0)).toBe(true);
  });

  it('crosses a year boundary', () => {
    const forecast = projectCashFlow({ transactions: [], subscriptions: [] }, {
      now: new Date(2026, 10, 15), horizonMonths: 3,
    });
    expect(forecast.months.map(m => m.monthKey)).toEqual(['2026-11', '2026-12', '2027-01']);
  });
});

describe('summarizeForecast', () => {
  it('explains the shortfall rather than the numbers when history is thin', () => {
    const forecast = projectCashFlow({ transactions: [tx('2026-06-10', 10)], subscriptions: [] }, { now });
    expect(summarizeForecast(forecast)).toMatch(/1 complete month of history/);
  });

  it('names the first short month', () => {
    const forecast = projectCashFlow({
      transactions: history(), subscriptions: [salary, { ...rent, amount: 20000 }],
    }, { now, horizonMonths: 3 });
    expect(summarizeForecast(forecast)).toMatch(/first month that runs short/);
  });

  it('reports a surplus when there is one', () => {
    const forecast = projectCashFlow({
      transactions: history(), subscriptions: [salary, rent],
    }, { now, horizonMonths: 3 });
    expect(summarizeForecast(forecast)).toMatch(/stay in surplus/);
  });
});
