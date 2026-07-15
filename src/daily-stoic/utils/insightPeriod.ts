import { getCycleInfo, cycleDayToDateStr, getCycleDay } from './date';

export type InsightPeriod = 'cycle' | 'quarter' | 'year' | 'all';

export const INSIGHT_PERIOD_OPTIONS: { value: InsightPeriod; label: string }[] = [
  { value: 'cycle', label: 'Cycle' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All' },
];

export interface InsightPeriodRange {
  startDay: number; // absolute day number, inclusive
  endDay: number; // absolute day number, inclusive — always `today`
  start: string; // real calendar date, inclusive
  end: string;
  totalDays: number; // endDay - startDay + 1 — the actual elapsed span, not a fixed window
}

// "Quarter" and "year" are anchored to real calendar months/years (via
// Date.setMonth/setFullYear), not a fixed day count like "3 * 28 = 84 days"
// or "365 days" — a fixed count would silently drift out of step with what
// a real quarter/year means (a quarter is ~91 days, not 84; a year is 366
// days whenever it spans Feb 29). Recomputing from the real calendar date
// every time — the same way JS Date's own month/year rollover works — means
// there's no accumulated state to drift: each call is independently exact
// relative to `today`.
function calendarMonthsAgoDay(cycleStartDate: string, today: number, monthsBack: number): number {
  const todayDate = new Date(cycleDayToDateStr(today, cycleStartDate) + 'T00:00:00');
  todayDate.setMonth(todayDate.getMonth() - monthsBack);
  return getCycleDay(cycleStartDate, todayDate);
}

// Cycle-boundary-aware for "cycle": it starts exactly at a cycle boundary
// and ends at today, so a cycle only 5 days in reports totalDays=5, not 28 —
// it never reaches back into the previous cycle to pad out a fixed window.
// Returns null for "all" (no filtering).
export function getInsightPeriodRange(
  period: InsightPeriod,
  cycleStartDate: string,
  today: number
): InsightPeriodRange | null {
  if (period === 'all') return null;

  let startDay: number;

  if (period === 'cycle') {
    const currentCycle = getCycleInfo(today).cycle;
    startDay = (currentCycle - 1) * 28 + 1;
  } else if (period === 'quarter') {
    startDay = calendarMonthsAgoDay(cycleStartDate, today, 3);
  } else {
    startDay = calendarMonthsAgoDay(cycleStartDate, today, 12);
  }

  return {
    startDay,
    endDay: today,
    start: cycleDayToDateStr(startDay, cycleStartDate),
    end: cycleDayToDateStr(today, cycleStartDate),
    totalDays: today - startDay + 1,
  };
}
