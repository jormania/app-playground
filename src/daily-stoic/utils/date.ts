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
