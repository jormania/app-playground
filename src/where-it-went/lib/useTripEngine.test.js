import { describe, it, expect } from 'vitest';
import { planTripTransitions } from './useTripEngine';

describe('planTripTransitions', () => {
  const trip = (overrides = {}) => ({
    id: 't1',
    name: 'Test Trip',
    status: 'Planned',
    startDate: '2026-08-01',
    endDate: '2026-08-10',
    ...overrides
  });

  const run = (trips, todayStr) => {
    // Parse the todayStr into a local date at noon to avoid timezone shift issues
    const parts = todayStr.split('-');
    const today = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), 12, 0, 0);
    return planTripTransitions({ trips }, today);
  };

  it('keeps a future trip as Planned', () => {
    const trips = [trip({ status: 'Planned' })];
    const transitions = run(trips, '2026-07-20');
    expect(transitions).toHaveLength(0); // No change needed
  });

  it('transitions a trip to Active on its start date', () => {
    const trips = [trip({ status: 'Planned' })];
    const transitions = run(trips, '2026-08-01');
    expect(transitions).toHaveLength(1);
    expect(transitions[0].trip.id).toBe('t1');
    expect(transitions[0].newStatus).toBe('Active');
  });

  it('transitions a trip to Active during its duration', () => {
    const trips = [trip({ status: 'Planned' })];
    const transitions = run(trips, '2026-08-05');
    expect(transitions).toHaveLength(1);
    expect(transitions[0].newStatus).toBe('Active');
  });

  it('transitions a trip to Completed the day after its end date', () => {
    const trips = [trip({ status: 'Active' })];
    const transitions = run(trips, '2026-08-11');
    expect(transitions).toHaveLength(1);
    expect(transitions[0].newStatus).toBe('Completed');
  });

  it('transitions a Planned trip directly to Completed if it ended in the past', () => {
    const trips = [trip({ status: 'Planned' })];
    const transitions = run(trips, '2026-08-15');
    expect(transitions).toHaveLength(1);
    expect(transitions[0].newStatus).toBe('Completed');
  });

  it('does nothing if the trip is already in the correct state', () => {
    const trips = [trip({ status: 'Active' })];
    const transitions = run(trips, '2026-08-05');
    expect(transitions).toHaveLength(0);
  });

  it('ignores trips with no dates set', () => {
    const trips = [trip({ status: 'Planned', startDate: null, endDate: null })];
    const transitions = run(trips, '2026-08-15');
    expect(transitions).toHaveLength(0);
  });

  it('handles trips with only a start date (Active indefinitely)', () => {
    const trips = [trip({ status: 'Planned', startDate: '2026-08-01', endDate: null })];
    const transitions = run(trips, '2026-08-05');
    expect(transitions).toHaveLength(1);
    expect(transitions[0].newStatus).toBe('Active');
  });
});
