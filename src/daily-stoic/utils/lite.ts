import { ReflectionRecord } from '../services/NotionService';

// Lite has no dashboards to visit, so the one worthwhile look backwards comes
// to the user instead: after saving, the obstacle they logged 30, 90 or 365
// days ago — the same "trivialized obstacles" idea as the Amor Fati
// retrospective, narrowed to a single card.
export const LITE_LOOKBACKS = [30, 90, 365] as const;

export interface LiteRetrospective {
  record: ReflectionRecord;
  daysAgo: number;
}

/** Nearest lookback first. Only records with something written in FateInput
 *  qualify — an empty obstacle is not worth surfacing. `dayOfYear` is the
 *  app's unbounded cycle day, which is also the Notion QuoteID. */
export function pickLiteRetrospective(
  reflections: ReflectionRecord[],
  dayOfYear: number
): LiteRetrospective | null {
  for (const daysAgo of LITE_LOOKBACKS) {
    const target = dayOfYear - daysAgo;
    if (target < 1) continue;
    const record = reflections.find(
      (r) => r.quoteId === target && (r.fateInput || '').trim().length > 0
    );
    if (record) return { record, daysAgo };
  }
  return null;
}

/** Does this record hold anything the user actually wrote or tapped? */
export function hasContent(r: ReflectionRecord | undefined): boolean {
  if (!r) return false;
  return Boolean(
    (r.text || '').trim() ||
    (r.fateInput || '').trim() ||
    (r.mood || '').trim() ||
    (r.morningIntentions || '').trim() ||
    (r.virtue || '').trim() ||
    (r.passions || []).length > 0
  );
}

export interface WeekDot {
  /** Absolute cycle day this dot stands for. */
  day: number;
  logged: boolean;
  isToday: boolean;
  /** Days after today — drawn faint, never as a miss. */
  future: boolean;
}

/** The seven days of the cycle-week `dayOfYear` falls in. Lite shows these as
 *  dots instead of a streak count: a filled week invites you to fill the next
 *  day, where a broken 40-day streak invites you to stop. `todayLogged` comes
 *  from the editor's own state, so the dot fills the moment you save rather
 *  than after the next fetch. */
export function weekDots(
  reflections: ReflectionRecord[],
  dayOfYear: number,
  todayLogged: boolean
): WeekDot[] {
  const dayOfWeek = ((Math.max(1, dayOfYear) - 1) % 7) + 1;
  const weekStart = dayOfYear - dayOfWeek + 1;
  const byDay = new Map<number, ReflectionRecord>();
  reflections.forEach((r) => byDay.set(r.quoteId, r));

  return Array.from({ length: 7 }, (_, i) => {
    const day = weekStart + i;
    const isToday = day === dayOfYear;
    return {
      day,
      isToday,
      future: day > dayOfYear,
      logged: isToday ? todayLogged : hasContent(byDay.get(day)),
    };
  });
}

export interface PreviousEntry {
  daysAgo: number;
  text: string;
}

/** The last thing written before today, for the one quiet line under the
 *  header. Looks back up to a week so a skipped day doesn't break the thread;
 *  prefers the reflection, falls back to the obstacle. */
export function previousEntry(
  reflections: ReflectionRecord[],
  dayOfYear: number,
  maxLookback = 7
): PreviousEntry | null {
  const byDay = new Map<number, ReflectionRecord>();
  reflections.forEach((r) => byDay.set(r.quoteId, r));

  for (let back = 1; back <= maxLookback; back++) {
    const day = dayOfYear - back;
    if (day < 1) break;
    const rec = byDay.get(day);
    if (!rec) continue;
    const text = firstLine(rec.text) || (rec.fateInput || '').trim();
    if (text) return { daysAgo: back, text };
  }
  return null;
}

/** First meaningful line of a reflection — skipping the `### question` headers
 *  a day written in the full journal carries. */
function firstLine(text: string | undefined): string {
  return (text || '')
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('###')) || '';
}

// One tap when the box is blank and the day is not. Kept deliberately short
// and answerable: a prompt you have to decode is worse than no prompt.
export const REFLECTION_PROMPTS = [
  'What did today ask of you that you did not expect?',
  'Where did you act well, however small?',
  'What did you want that you could not have?',
  'Who did you meet badly, and what would meeting them well have cost?',
  'What did you postpone, and why?',
  'What went right that you had nothing to do with?',
  'What would you do differently if today ran again?',
  'What are you still carrying from earlier in the day?',
  'Where did you spend attention you meant to spend elsewhere?',
  'What is true today that was not true yesterday?',
];

/** A prompt for this day — deterministic, so it doesn't churn on re-render.
 *  `nudge` advances it when the user asks for another. */
export function promptForDay(dayOfYear: number, nudge = 0): string {
  const n = REFLECTION_PROMPTS.length;
  const i = (((Math.floor(dayOfYear) + nudge) % n) + n) % n;
  return REFLECTION_PROMPTS[i]!;
}
