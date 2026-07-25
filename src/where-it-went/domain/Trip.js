/**
 * Domain entity helpers for Trip objects.
 * A Trip represents a real-world journey (e.g. "Billund 2025") that complements financial Categories.
 */

export const TRIP_STATUSES = ['Planned', 'Active', 'Completed'];

export function formatTripDates(startDate, endDate) {
  if (!startDate && !endDate) return 'No dates set';
  
  const formatDateStr = (dateStr) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('T')[0].split('-');
      if (parts.length === 3) {
        const date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  if (startDate && !endDate) return `From ${formatDateStr(startDate)}`;
  if (!startDate && endDate) return `Until ${formatDateStr(endDate)}`;
  
  const sFormatted = formatDateStr(startDate);
  const eFormatted = formatDateStr(endDate);
  
  // If same year, simplify format
  if (startDate && endDate && startDate.substring(0, 4) === endDate.substring(0, 4)) {
    const sShort = sFormatted.replace(/, \d{4}$/, '');
    return `${sShort} – ${eFormatted}`;
  }
  
  return `${sFormatted} – ${eFormatted}`;
}

export function getTripStatusBadge(status) {
  const norm = status || 'Planned';
  switch (norm) {
    case 'Active':
      return {
        label: 'Active',
        color: 'var(--color-success)',
        bgColor: 'color-mix(in srgb, var(--color-success) 15%, transparent)'
      };
    case 'Completed':
      return {
        label: 'Completed',
        color: 'var(--color-muted)',
        bgColor: 'color-mix(in srgb, var(--color-muted) 15%, transparent)'
      };
    case 'Planned':
    default:
      return {
        label: 'Planned',
        color: 'var(--color-accent)',
        bgColor: 'color-mix(in srgb, var(--color-accent) 15%, transparent)'
      };
  }
}

export function belongsToTrip(tx, tripId) {
  if (!tripId || tripId === 'all') return true;
  if (tripId === 'unassigned') {
    return !tx.tripId || tx.tripId === '' || tx.tripId === 'unassigned';
  }
  return tx.tripId === tripId;
}

export function formatTripLabel(trip) {
  if (!trip) return 'Unknown Trip';
  return trip.name || 'Unnamed Trip';
}

export function validateTrip(tripData) {
  const errors = [];
  if (!tripData || !tripData.name || !tripData.name.trim()) {
    errors.push('Trip name is required.');
  }
  if (tripData.startDate && tripData.endDate) {
    if (new Date(tripData.startDate) > new Date(tripData.endDate)) {
      errors.push('End date cannot be before start date.');
    }
  }
  return {
    valid: errors.length === 0,
    errors
  };
}
