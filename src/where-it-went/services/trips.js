/**
 * Service layer for Trips domain operations.
 */
import { belongsToTrip } from '../domain/Trip';

export function sortTrips(trips) {
  if (!Array.isArray(trips)) return [];
  return [...trips].sort((a, b) => {
    // Order by status: Active -> Planned -> Completed
    const statusOrder = { Active: 1, Planned: 2, Completed: 3 };
    const orderA = statusOrder[a.status || 'Planned'] || 2;
    const orderB = statusOrder[b.status || 'Planned'] || 2;
    if (orderA !== orderB) return orderA - orderB;
    
    // Within same status, sort by start date
    const dateA = a.startDate ? new Date(a.startDate).getTime() : 0;
    const dateB = b.startDate ? new Date(b.startDate).getTime() : 0;
    if (a.status === 'Completed') {
      return dateB - dateA; // Most recently completed first
    }
    return dateA - dateB; // Soonest upcoming first
  });
}

export function filterTrips(trips, searchQuery) {
  if (!Array.isArray(trips)) return [];
  if (!searchQuery || !searchQuery.trim()) return sortTrips(trips);
  
  const query = searchQuery.toLowerCase().trim();
  const filtered = trips.filter(trip => {
    const nameMatch = (trip.name || '').toLowerCase().includes(query);
    const destMatch = (trip.destination || '').toLowerCase().includes(query);
    const notesMatch = (trip.notes || '').toLowerCase().includes(query);
    return nameMatch || destMatch || notesMatch;
  });
  return sortTrips(filtered);
}

export function getTripForTransaction(tx, trips) {
  if (!tx || !tx.tripId || !Array.isArray(trips)) return null;
  return trips.find(t => t.id === tx.tripId) || null;
}

export function getTransactionsForTrip(transactions, tripId) {
  if (!Array.isArray(transactions)) return [];
  return transactions.filter(tx => belongsToTrip(tx, tripId));
}

export function getTripStats(tripId, transactions) {
  if (!tripId || !Array.isArray(transactions)) {
    return { totalSpend: 0, count: 0 };
  }
  const tripTxs = getTransactionsForTrip(transactions, tripId).filter(t => t.type === 'Expense');
  const totalSpend = tripTxs.reduce((sum, t) => sum + (t.amount || 0), 0);
  return {
    totalSpend,
    count: tripTxs.length
  };
}
