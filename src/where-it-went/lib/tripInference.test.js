import { describe, it, expect } from 'vitest';
import {
  isTripOngoing,
  tripsOnDate,
  inferTrip,
  findTravelCategory,
  applyTripContext,
} from './tripInference';

const POLAND = {
  id: 'trip_poland',
  name: 'Poland Autumn',
  destination: 'Kraków',
  startDate: '2026-10-05',
  endDate: '2026-10-15',
  status: 'Active',
  currency: 'PLN',
};

const GERMANY = {
  id: 'trip_germany',
  name: 'Lake Constance',
  startDate: '2026-10-10',
  endDate: '2026-10-20',
  status: 'Active',
  currency: 'EUR',
};

const CATEGORIES = [
  { id: 'cat_travel', name: 'Travel', type: 'Expense' },
  { id: 'cat_dining', name: 'Dining', type: 'Expense' },
  { id: 'cat_salary', name: 'Salary', type: 'Income' },
];

describe('isTripOngoing', () => {
  it('includes both endpoints of the window', () => {
    expect(isTripOngoing(POLAND, '2026-10-05')).toBe(true);
    expect(isTripOngoing(POLAND, '2026-10-15')).toBe(true);
  });

  it('excludes dates outside the window', () => {
    expect(isTripOngoing(POLAND, '2026-10-04')).toBe(false);
    expect(isTripOngoing(POLAND, '2026-10-16')).toBe(false);
  });

  it('treats a one-sided window as still running', () => {
    expect(isTripOngoing({ startDate: '2026-10-05' }, '2027-01-01')).toBe(true);
    expect(isTripOngoing({ endDate: '2026-10-15' }, '2020-01-01')).toBe(true);
  });

  it('is false for a trip with no dates at all', () => {
    expect(isTripOngoing({ id: 't', status: 'Active' }, '2026-10-06')).toBe(false);
  });

  it('tolerates a full timestamp in the date field', () => {
    expect(isTripOngoing({ startDate: '2026-10-05T00:00:00.000Z', endDate: '2026-10-15' }, '2026-10-06')).toBe(true);
  });
});

describe('tripsOnDate', () => {
  it('returns every trip covering the date', () => {
    expect(tripsOnDate([POLAND, GERMANY], '2026-10-12').map(t => t.id))
      .toEqual(['trip_poland', 'trip_germany']);
  });

  it('ignores trips without an id', () => {
    expect(tripsOnDate([{ ...POLAND, id: null }], '2026-10-06')).toEqual([]);
  });
});

describe('inferTrip', () => {
  it('picks the single trip whose window contains the date', () => {
    expect(inferTrip([POLAND, GERMANY], '2026-10-06')?.id).toBe('trip_poland');
  });

  it('returns null when no trip covers the date', () => {
    expect(inferTrip([POLAND, GERMANY], '2026-09-01')).toBeNull();
  });

  it('uses the currency to break a tie between overlapping trips', () => {
    expect(inferTrip([POLAND, GERMANY], '2026-10-12', 'PLN')?.id).toBe('trip_poland');
    expect(inferTrip([POLAND, GERMANY], '2026-10-12', 'EUR')?.id).toBe('trip_germany');
  });

  it('refuses to guess between overlapping trips with no currency signal', () => {
    expect(inferTrip([POLAND, GERMANY], '2026-10-12')).toBeNull();
    expect(inferTrip([POLAND, GERMANY], '2026-10-12', 'USD')).toBeNull();
  });

  it('falls back to a single undated Active trip', () => {
    const undated = { id: 'trip_x', name: 'Somewhere', status: 'Active' };
    expect(inferTrip([undated], '2026-10-06')?.id).toBe('trip_x');
  });

  it('does not fall back when two undated trips are both Active', () => {
    const a = { id: 'a', status: 'Active' };
    const b = { id: 'b', status: 'Active' };
    expect(inferTrip([a, b], '2026-10-06')).toBeNull();
  });

  it('prefers a dated match over an undated Active trip', () => {
    const undated = { id: 'trip_x', status: 'Active' };
    expect(inferTrip([undated, POLAND], '2026-10-06')?.id).toBe('trip_poland');
  });
});

describe('findTravelCategory', () => {
  it('finds a category named Travel', () => {
    expect(findTravelCategory(CATEGORIES)?.id).toBe('cat_travel');
  });

  it('ignores an inactive or income Travel category', () => {
    expect(findTravelCategory([{ id: 'x', name: 'Travel', type: 'Expense', active: false }])).toBeNull();
    expect(findTravelCategory([{ id: 'x', name: 'Travel Refunds', type: 'Income' }])).toBeNull();
  });

  it('returns null when the workspace has no Travel category', () => {
    expect(findTravelCategory([{ id: 'd', name: 'Dining', type: 'Expense' }])).toBeNull();
  });
});

describe('applyTripContext', () => {
  const context = { trips: [POLAND], categories: CATEGORIES };

  it('links the trip, reads the amount as the trip currency and files it as Travel', () => {
    const { tx, inferred } = applyTripContext(
      { amount: 30, date: '2026-10-06', type: 'Expense', description: 'Lunch at Restaurant', categoryId: 'cat_dining' },
      context,
    );
    expect(tx.tripId).toBe('trip_poland');
    expect(tx.originalCurrency).toBe('PLN');
    expect(tx.originalAmount).toBe(30);
    expect(tx.categoryId).toBe('cat_travel');
    expect(inferred.trip.id).toBe('trip_poland');
    expect(inferred.currency).toBe('PLN');
    expect(inferred.category.id).toBe('cat_travel');
  });

  it('leaves a currency the user actually named alone', () => {
    const { tx, inferred } = applyTripContext(
      { amount: 50, date: '2026-10-06', type: 'Expense', originalCurrency: 'RON' },
      context,
    );
    expect(tx.originalCurrency).toBe('RON');
    expect(tx.originalAmount).toBeUndefined();
    expect(inferred.currency).toBeUndefined();
    expect(tx.tripId).toBe('trip_poland');
  });

  it('does not report a trip the caller already resolved as inferred', () => {
    const { tx, inferred } = applyTripContext(
      { amount: 30, date: '2026-10-06', type: 'Expense', tripId: 'trip_poland' },
      context,
    );
    expect(tx.tripId).toBe('trip_poland');
    expect(inferred.trip).toBeUndefined();
    expect(inferred.currency).toBe('PLN');
  });

  it('leaves transactions outside any trip window untouched', () => {
    const input = { amount: 30, date: '2026-09-01', type: 'Expense', categoryId: 'cat_dining' };
    const { tx, inferred } = applyTripContext(input, context);
    expect(tx.tripId).toBeUndefined();
    expect(tx.categoryId).toBe('cat_dining');
    expect(inferred).toEqual({});
  });

  it('skips recurring bills that merely renew mid-trip', () => {
    const input = { amount: 50, date: '2026-10-06', type: 'Expense', isSubscription: true, categoryId: 'cat_dining' };
    const { tx, inferred } = applyTripContext(input, context);
    expect(tx.tripId).toBeUndefined();
    expect(tx.categoryId).toBe('cat_dining');
    expect(inferred).toEqual({});
  });

  it('skips transfers and deletes', () => {
    expect(applyTripContext({ amount: 30, date: '2026-10-06', type: 'Transfer' }, context).tx.tripId).toBeUndefined();
    expect(applyTripContext({ action: 'delete', id: 'x' }, context).tx.tripId).toBeUndefined();
  });

  it('does not infer a trip for income, and never files income as Travel', () => {
    const { tx } = applyTripContext(
      { amount: 500, date: '2026-10-06', type: 'Income', categoryId: 'cat_salary' },
      context,
    );
    expect(tx.tripId).toBeUndefined();
    expect(tx.categoryId).toBe('cat_salary');
  });

  it('still links the trip when the workspace has no Travel category', () => {
    const { tx } = applyTripContext(
      { amount: 30, date: '2026-10-06', type: 'Expense', categoryId: 'cat_dining' },
      { trips: [POLAND], categories: [{ id: 'cat_dining', name: 'Dining', type: 'Expense' }] },
    );
    expect(tx.tripId).toBe('trip_poland');
    expect(tx.categoryId).toBe('cat_dining');
  });

  it('does not default the currency for a trip that spends RON', () => {
    const domestic = { ...POLAND, id: 'trip_home', currency: 'RON' };
    const { tx, inferred } = applyTripContext(
      { amount: 30, date: '2026-10-06', type: 'Expense' },
      { trips: [domestic], categories: CATEGORIES },
    );
    expect(tx.originalCurrency).toBeUndefined();
    expect(inferred.currency).toBeUndefined();
    expect(tx.tripId).toBe('trip_home');
  });

  it('does not mutate the input', () => {
    const input = { amount: 30, date: '2026-10-06', type: 'Expense', categoryId: 'cat_dining' };
    applyTripContext(input, context);
    expect(input.tripId).toBeUndefined();
    expect(input.categoryId).toBe('cat_dining');
  });
});
