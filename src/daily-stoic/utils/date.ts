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

// The app's "day number" (QuoteID) is an unbounded count of days since
// cycleStartDate — not the calendar day-of-year, and (as of the 28-day cycle
// rewrite) not wrapped at any fixed length either. Cycles/weeks are a pure
// derived view over this count (see getCycleInfo); the count itself just
// keeps growing, which also means QuoteID can never collide across cycles
// the way a wrapping counter could. Quote rotation cycles through its own
// 366-quote list independently (see getQuoteForDay), so an unbounded input
// here doesn't change what quote shows on a given day.
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
  return diffDays + 1;
}

/** The Four Cardinal Virtues, in fixed weekly rotation order (Week 1 → 4). */
export const WEEK_VIRTUES = ['Wisdom', 'Courage', 'Justice', 'Temperance'] as const;
export type WeekVirtue = (typeof WEEK_VIRTUES)[number];

export interface CycleInfo {
  cycle: number;
  week: number; // 1-4
  dayOfWeek: number; // 1-7, Monday = 1
}

// A 28-day cycle is four 7-day weeks, each themed to one Cardinal Virtue.
// cycleStartDate is required to be a Monday (enforced at every point a new
// cycle can begin — see mostRecentMonday), and 28 is a multiple of 7, so
// every week boundary this produces lands exactly on a real Monday: "week"
// here and "calendar week" always agree, by construction.
export function getCycleInfo(absoluteDay: number): CycleInfo {
  const zeroIdx = Math.max(0, absoluteDay - 1);
  const cycle = Math.floor(zeroIdx / 28) + 1;
  const dayInCycle = zeroIdx % 28;
  const week = Math.floor(dayInCycle / 7) + 1;
  const dayOfWeek = (dayInCycle % 7) + 1;
  return { cycle, week, dayOfWeek };
}

export function getVirtueForWeek(week: number): WeekVirtue {
  return WEEK_VIRTUES[(week - 1) % WEEK_VIRTUES.length];
}

export function formatCycleLabel(info: CycleInfo): string {
  return `Day ${info.dayOfWeek} of Week ${info.week} of Cycle ${info.cycle}`;
}

// A shorter variant for tight spaces (e.g. a subheader under a wizard step
// title) — same information as formatCycleLabel, middle-dot separated.
export function formatCycleLabelCompact(info: CycleInfo): string {
  return `Day ${info.dayOfWeek} · Week ${info.week} · Cycle ${info.cycle}`;
}

// Theme tags (from data/quotes.ts) that count as "about" each virtue, for the
// weekly Quote of the Week banner. Deliberately doesn't touch the existing
// daily quote rotation (getQuoteForDay) — this is a separate, second quote.
// "Temperance" has no quote tagged with that exact word, so it matches the
// closest adjacent themes instead.
const VIRTUE_THEME_TAGS: Record<WeekVirtue, string[]> = {
  Wisdom: ['Wisdom'],
  Courage: ['Courage'],
  Justice: ['Justice'],
  Temperance: ['Control', 'Discipline', 'Restraint'],
};

// One quote per week, stable across all 7 days of that week, themed to the
// week's virtue. Picks deterministically from the matching pool using cycle
// + week as the seed, so the same week number (e.g. every Week 2) doesn't
// always resurface the exact same quote cycle after cycle.
export function getQuoteOfTheWeek(info: CycleInfo): Quote | null {
  const virtue = getVirtueForWeek(info.week);
  const tags = VIRTUE_THEME_TAGS[virtue];
  const matches = QUOTES.filter((q) => q.theme.some((t) => tags.includes(t)));
  if (matches.length === 0) return null;
  const seed = info.cycle * WEEK_VIRTUES.length + info.week;
  return matches[seed % matches.length];
}

// Snaps back to the most recent Monday (or the date itself, if it already is
// one). Used whenever a new cycle can start — the natural 28-day rollover
// already preserves the Monday-start invariant on its own since 28 is a
// multiple of 7, so this only matters for a manual "start over" reset,
// which could otherwise happen on any day of the week.
export function mostRecentMonday(date: Date = new Date()): Date {
  const day = date.getDay(); // 0 = Sunday ... 6 = Saturday
  const diffFromMonday = day === 0 ? 6 : day - 1;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - diffFromMonday);
}

// The inverse of getCycleDay: the calendar date a given cycle-day position maps
// to, anchored at cycleStartDate (or Jan 1 of the current year if no cycle has
// been started yet — matching getCycleDay's own fallback). Every write path that
// needs "what real date does cycle day N correspond to" must go through this, or
// they silently drift apart (as the favorite-toggle path once did, anchoring to
// Jan 1 unconditionally regardless of the actual cycle start).
export function cycleDayToDateStr(dayNum: number, cycleStartDate: string, today: Date = new Date()): string {
  const startStr = cycleStartDate || `${today.getFullYear()}-01-01`;
  const start = new Date(startStr);
  const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + (dayNum - 1));
  return getLocalTodayStr(date);
}

