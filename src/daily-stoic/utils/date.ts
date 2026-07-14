import { QUOTES, Quote } from '../data/quotes';

export function getDayOfYear(date: Date = new Date()): number {
  const utcDate = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const utcStart = Date.UTC(date.getFullYear(), 0, 1);
  return Math.floor((utcDate - utcStart) / (1000 * 60 * 60 * 24)) + 1;
}

export function getQuoteForDay(dayOfYear: number): Quote {
  const index = (dayOfYear - 1) % QUOTES.length;
  return QUOTES[index];
}

export function formatDateLabel(date: Date = new Date()): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function getLocalTodayStr(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// The app's "day number" (QuoteID) is a position in the user's 365-day cycle,
// not the calendar day-of-year — it must always be computed from cycleStartDate.
export function getCycleDay(startDateStr: string, today: Date = new Date()): number {
  if (!startDateStr) {
    const currentYear = today.getFullYear();
    const start = new Date(currentYear, 0, 1);
    const diff = today.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
  }
  const start = new Date(startDateStr);
  const startD = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const todayD = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = todayD.getTime() - startD.getTime();
  const diffDays = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  return (diffDays % 365) + 1;
}

