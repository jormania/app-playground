import { describe, it, expect } from 'vitest';
import { formatTripDates, getTripStatusBadge, belongsToTrip, formatTripLabel, validateTrip, isTripOngoing } from './Trip';

describe('Trip Domain Entity', () => {
  it('formats trip dates correctly', () => {
    expect(formatTripDates(null, null)).toBe('No dates set');
    expect(formatTripDates('2026-05-15', null)).toContain('From May 15, 2026');
    expect(formatTripDates('2026-05-15', '2026-05-22')).toContain('May 15');
    expect(formatTripDates('2026-05-15', '2026-05-22')).toContain('May 22, 2026');
  });

  it('returns correct status badges', () => {
    expect(getTripStatusBadge('Active').label).toBe('Active');
    expect(getTripStatusBadge('Completed').label).toBe('Completed');
    expect(getTripStatusBadge('Planned').label).toBe('Planned');
    expect(getTripStatusBadge(null).label).toBe('Planned');
  });

  it('evaluates whether transaction belongs to trip', () => {
    const tx = { id: 'tx1', tripId: 'trip_1' };
    const txNoTrip = { id: 'tx2' };

    expect(belongsToTrip(tx, 'all')).toBe(true);
    expect(belongsToTrip(txNoTrip, 'all')).toBe(true);
    expect(belongsToTrip(tx, 'trip_1')).toBe(true);
    expect(belongsToTrip(tx, 'trip_2')).toBe(false);
    expect(belongsToTrip(txNoTrip, 'unassigned')).toBe(true);
    expect(belongsToTrip(tx, 'unassigned')).toBe(false);
  });

  it('formats trip label', () => {
    expect(formatTripLabel({ name: 'Billund 2025' })).toBe('Billund 2025');
    expect(formatTripLabel(null)).toBe('Unknown Trip');
  });

  it('validates trip data', () => {
    expect(validateTrip({ name: 'Poland 2026' }).valid).toBe(true);
    expect(validateTrip({ name: '' }).valid).toBe(false);
    expect(validateTrip({ name: 'Test', startDate: '2026-06-01', endDate: '2026-05-01' }).valid).toBe(false);
  });

  describe('isTripOngoing', () => {
    const trip = { startDate: '2026-10-05', endDate: '2026-10-15' };

    it('includes both endpoints of the window', () => {
      expect(isTripOngoing(trip, '2026-10-05')).toBe(true);
      expect(isTripOngoing(trip, '2026-10-15')).toBe(true);
    });

    it('excludes dates outside the window', () => {
      expect(isTripOngoing(trip, '2026-10-04')).toBe(false);
      expect(isTripOngoing(trip, '2026-10-16')).toBe(false);
    });

    it('treats a one-sided window as still running', () => {
      expect(isTripOngoing({ startDate: '2026-10-05' }, '2027-01-01')).toBe(true);
      expect(isTripOngoing({ endDate: '2026-10-15' }, '2020-01-01')).toBe(true);
    });

    it('is false for a trip with no dates, and for missing arguments', () => {
      expect(isTripOngoing({ status: 'Active' }, '2026-10-06')).toBe(false);
      expect(isTripOngoing(null, '2026-10-06')).toBe(false);
      expect(isTripOngoing(trip, '')).toBe(false);
    });

    it('tolerates a full timestamp in the date field', () => {
      expect(isTripOngoing({ startDate: '2026-10-05T00:00:00.000Z', endDate: '2026-10-15' }, '2026-10-06')).toBe(true);
    });
  });
});
