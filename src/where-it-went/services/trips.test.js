import { describe, it, expect } from 'vitest';
import { sortTrips, filterTrips, getTripForTransaction, getTransactionsForTrip, getTripStats } from './trips';

describe('Trips Service Layer', () => {
  const sampleTrips = [
    { id: 't1', name: 'Billund 2025', status: 'Completed', startDate: '2025-05-10', endDate: '2025-05-15', destination: 'Denmark' },
    { id: 't2', name: 'Poland 2026', status: 'Active', startDate: '2026-07-20', endDate: '2026-07-30', destination: 'Poland' },
    { id: 't3', name: 'Lake Constance 2026', status: 'Planned', startDate: '2026-09-01', endDate: '2026-09-10', destination: 'Germany' }
  ];

  it('sorts trips by status and date', () => {
    const sorted = sortTrips(sampleTrips);
    expect(sorted[0].id).toBe('t2'); // Active first
    expect(sorted[1].id).toBe('t3'); // Planned next
    expect(sorted[2].id).toBe('t1'); // Completed last
  });

  it('filters trips by search query', () => {
    expect(filterTrips(sampleTrips, 'poland').length).toBe(1);
    expect(filterTrips(sampleTrips, 'denmark').length).toBe(1);
    expect(filterTrips(sampleTrips, '2026').length).toBe(2);
    expect(filterTrips(sampleTrips, '').length).toBe(3);
  });

  it('finds trip for transaction', () => {
    const tx = { id: 'tx1', tripId: 't2' };
    const trip = getTripForTransaction(tx, sampleTrips);
    expect(trip?.name).toBe('Poland 2026');
  });

  it('filters transactions for a trip', () => {
    const txs = [
      { id: 'tx1', tripId: 't2', amount: 100, type: 'Expense' },
      { id: 'tx2', tripId: 't2', amount: 200, type: 'Expense' },
      { id: 'tx3', tripId: 't1', amount: 500, type: 'Expense' },
      { id: 'tx4', amount: 50, type: 'Expense' } // Unassigned
    ];

    expect(getTransactionsForTrip(txs, 't2').length).toBe(2);
    expect(getTransactionsForTrip(txs, 'all').length).toBe(4);
    expect(getTransactionsForTrip(txs, 'unassigned').length).toBe(1);
    expect(getTransactionsForTrip(txs, 'unassigned')[0].id).toBe('tx4');
  });

  it('computes trip statistics', () => {
    const txs = [
      { id: 'tx1', tripId: 't2', amount: 100, type: 'Expense' },
      { id: 'tx2', tripId: 't2', amount: 200, type: 'Expense' }
    ];
    const stats = getTripStats('t2', txs);
    expect(stats.totalSpend).toBe(300);
    expect(stats.count).toBe(2);
  });
});
