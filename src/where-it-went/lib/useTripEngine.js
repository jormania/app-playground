import { useEffect, useRef } from 'react';
import { toDateString } from './period';

/**
 * Evaluates trips to determine if any need an automatic status update based on today's date.
 * 
 * Rules for status transition:
 * - If today > endDate, status should be 'Completed'
 * - Else if today >= startDate, status should be 'Active'
 * - Else (today < startDate), status should be 'Planned'
 * 
 * @param {Object} data The current application data containing trips.
 * @param {Date} today The current date to evaluate against.
 * @returns {Array} List of objects { trip, newStatus } for trips that need updating.
 */
export function planTripTransitions(data, today = new Date()) {
  const trips = data?.trips || [];
  const todayStr = toDateString(today);
  const transitions = [];

  for (const trip of trips) {
    const currentStatus = trip.status || 'Planned';
    let newStatus = currentStatus;

    if (trip.endDate && todayStr > trip.endDate) {
      newStatus = 'Completed';
    } else if (trip.startDate && todayStr >= trip.startDate) {
      newStatus = 'Active';
    } else if (trip.startDate && todayStr < trip.startDate) {
      newStatus = 'Planned';
    }

    if (newStatus !== currentStatus) {
      transitions.push({ trip, newStatus });
    }
  }

  return transitions;
}

/**
 * A background engine that automatically synchronizes trip statuses based on their 
 * start and end dates. It runs exactly once per session when `enabled` is true.
 */
export function useTripEngine({ data, client, onDataChange, enabled = true }) {
  const hasRun = useRef(false);

  useEffect(() => {
    if (!enabled || hasRun.current) return;
    if (!data || !data.trips || data.trips.length === 0) return;

    hasRun.current = true;

    (async () => {
      const transitions = planTripTransitions(data, new Date());
      let madeChanges = false;

      for (const { trip, newStatus } of transitions) {
        try {
          await client.updateTrip(trip.id, { status: newStatus });
          madeChanges = true;
        } catch (error) {
          console.error(`Failed to automatically update trip status for ${trip.id}:`, error);
        }
      }

      if (madeChanges && onDataChange) {
        onDataChange();
      }
    })();
  }, [data, client, onDataChange, enabled]);
}
