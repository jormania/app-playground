/**
 * Calculates the current reflection streak based on a set of completed
 * absolute cycle-day numbers (see utils/date.ts's getCycleDay — an unbounded
 * count since cycleStartDate, no longer wrapped at any fixed length). The
 * streak is defined as consecutive days ending in either today or yesterday.
 */
export function calculateStreak(reflectedDays: Set<number>, todayDayNumber: number): number {
  if (reflectedDays.size === 0) return 0;

  let currentDay = todayDayNumber;
  let streak = 0;

  // If there is an entry for today, count backwards starting from today
  if (reflectedDays.has(currentDay)) {
    while (reflectedDays.has(currentDay)) {
      streak++;
      currentDay -= 1;
    }
  } else {
    // If not today, check if there is an entry for yesterday
    const yesterday = currentDay - 1;
    if (reflectedDays.has(yesterday)) {
      currentDay = yesterday;
      while (reflectedDays.has(currentDay)) {
        streak++;
        currentDay -= 1;
      }
    }
  }

  return streak;
}
