import { ReflectionRecord } from '../services/NotionService';
import { Quote } from '../data/quotes';
import {
  CycleInfo,
  WeekVirtue,
  getCycleInfo,
  getVirtueForWeek,
  getQuoteOfTheWeek,
  cycleDayToDateStr,
  formatCycleLabel,
} from './date';
import { computeCycleRetrospective, CycleRetrospective, Worry } from './retrospective';

export interface DayDigestEntry {
  type: 'day';
  day: number;
  date: string;
  cycleInfo: CycleInfo;
  virtue: WeekVirtue;
  label: string;
  reflection: ReflectionRecord | null;
}

export interface WeekDigestEntry {
  type: 'week';
  cycle: number;
  week: number;
  virtue: WeekVirtue;
  dateRange: { start: string; end: string };
  quoteOfWeek: Quote | null;
  loggedCount: number;
}

export interface CycleDigestEntry {
  type: 'cycle';
  cycle: number;
  retrospective: CycleRetrospective;
}

export type DigestEntry = DayDigestEntry | WeekDigestEntry | CycleDigestEntry;

// The saved reflection text is built as "### Question\nAnswer" blocks joined
// by blank lines (see Journal.tsx's Seneca-question combiner) — split it back
// into question/answer pairs. Falls back to the raw text as a single block for
// older entries that don't follow this shape. Shared by the Digest's day modal
// and the Digest export so both render the interrogation identically.
export function parseReflectionQA(text?: string): { question: string; answer: string }[] {
  if (!text) return [];
  const blocks = text
    .split(/\n{0,2}###\s+/)
    .map((b) => b.trim())
    .filter(Boolean);
  if (blocks.length === 0) return [];
  return blocks.map((block) => {
    const breakIdx = block.indexOf('\n');
    return breakIdx === -1
      ? { question: block, answer: '' }
      : { question: block.slice(0, breakIdx).trim(), answer: block.slice(breakIdx + 1).trim() };
  });
}

// Newest-first, matching the "Newest first" convention already used by the
// other dashboards (see AmorFatiDashboard.tsx). Walking backward from `today`
// day-by-day, a week/cycle marker is emitted the moment its own last day
// (dayOfWeek === 7) is reached, but only once that day is genuinely in the
// past (`day < today`) — a week/cycle isn't "complete" on the day it ends.
// When a cycle and its own Week 4 end simultaneously, the cycle marker is
// pushed first so the bigger-picture entry sits above the week entry, which
// sits above the day itself — zoomed-out to zoomed-in, newest to oldest.
//
// Week/cycle entries deliberately do NOT collate/summarize day content: the
// week entry surfaces only its own pre-existing artifacts (virtue theme,
// Quote of the Week, a simple logged-day count), and the cycle entry reuses
// the same computeCycleRetrospective stats as the celebration screen — never
// anything derived by reading through that span's day entries.
export function buildDigestEntries(
  today: number,
  cycleStartDate: string,
  reflections: ReflectionRecord[],
  worries: Worry[]
): DigestEntry[] {
  const entries: DigestEntry[] = [];
  const reflectionsByDay = new Map<number, ReflectionRecord>();
  reflections.forEach((r) => reflectionsByDay.set(r.quoteId, r));

  for (let day = today; day >= 1; day--) {
    const info = getCycleInfo(day);
    const isWeekEnd = info.dayOfWeek === 7 && day < today;
    const isCycleEnd = isWeekEnd && info.week === 4;

    if (isCycleEnd) {
      entries.push({
        type: 'cycle',
        cycle: info.cycle,
        retrospective: computeCycleRetrospective(info.cycle, cycleStartDate, reflections, worries),
      });
    }

    if (isWeekEnd) {
      const dateRange = {
        start: cycleDayToDateStr(day - 6, cycleStartDate),
        end: cycleDayToDateStr(day, cycleStartDate),
      };
      const loggedCount = reflections.filter(
        (r) => r.date >= dateRange.start && r.date <= dateRange.end
      ).length;
      entries.push({
        type: 'week',
        cycle: info.cycle,
        week: info.week,
        virtue: getVirtueForWeek(info.week),
        dateRange,
        quoteOfWeek: getQuoteOfTheWeek(info),
        loggedCount,
      });
    }

    entries.push({
      type: 'day',
      day,
      date: cycleDayToDateStr(day, cycleStartDate),
      cycleInfo: info,
      virtue: getVirtueForWeek(info.week),
      label: formatCycleLabel(info),
      reflection: reflectionsByDay.get(day) || null,
    });
  }

  return entries;
}
