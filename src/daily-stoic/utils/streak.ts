/**
 * Calculates the current reflection streak based on a set of completed day-of-year numbers.
 * The streak is defined as consecutive days ending in either today or yesterday.
 * Wraps around the calendar year boundary (Day 1 follows Day 366).
 */
export function calculateStreak(reflectedDays: Set<number>, todayDayOfYear: number): number {
  if (reflectedDays.size === 0) return 0;

  let currentDay = todayDayOfYear;
  let streak = 0;

  // If there is an entry for today, count backwards starting from today
  if (reflectedDays.has(currentDay)) {
    while (reflectedDays.has(currentDay)) {
      streak++;
      currentDay = currentDay === 1 ? 366 : currentDay - 1;
    }
  } else {
    // If not today, check if there is an entry for yesterday
    const yesterday = currentDay === 1 ? 366 : currentDay - 1;
    if (reflectedDays.has(yesterday)) {
      currentDay = yesterday;
      while (reflectedDays.has(currentDay)) {
        streak++;
        currentDay = currentDay === 1 ? 366 : currentDay - 1;
      }
    }
  }

  return streak;
}
