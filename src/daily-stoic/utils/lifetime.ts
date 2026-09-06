// Memento Mori, reduced to what fits above a writing box.
//
// The full grid (components/MementoMori.tsx) draws 4,160 week blocks; Lite
// shows the same lifespan as a single bar. Both agree on the 80-year horizon
// and the same week arithmetic, so the two views can never disagree about how
// much of a life has gone.

export const LIFETIME_YEARS = 80;
export const LIFETIME_WEEKS = LIFETIME_YEARS * 52; // 4160

export interface LifeProgress {
  weeksLived: number;
  totalWeeks: number;
  /** 0-100, clamped — a life past 80 reads as full rather than overflowing. */
  percentage: number;
}

/** Null when no birth date is configured (or it doesn't parse) — the caller
 *  then prompts for one instead of rendering a bar of nothing. */
export function lifeProgress(birthDateString: string, now: Date = new Date()): LifeProgress | null {
  if (!birthDateString) return null;
  const birth = new Date(birthDateString);
  if (Number.isNaN(birth.getTime())) return null;

  const weeksLived = Math.max(
    0,
    Math.floor((now.getTime() - birth.getTime()) / (1000 * 60 * 60 * 24 * 7))
  );
  const percentage = Math.min(100, Math.max(0, (weeksLived / LIFETIME_WEEKS) * 100));

  return { weeksLived, totalWeeks: LIFETIME_WEEKS, percentage };
}

// The bar itself moves once a week, so the question underneath it is the part
// that stays alive: it changes every day.
export const MEMENTO_QUESTIONS = [
  'If this week were worth remembering, what would make it so?',
  'What would you refuse to spend today on, if you counted it against the bar above?',
  'Who deserves an hour of this week that they are not getting?',
  'What are you postponing as though the weeks were unlimited?',
  'If today repeated for a year, where would it leave you?',
  'What would you stop arguing about, seen from the end of the bar?',
  'What did you do this week that you would want counted?',
] as const;

export function questionForDay(dayOfYear: number): string {
  const n = MEMENTO_QUESTIONS.length;
  const index = ((Math.floor(dayOfYear) % n) + n) % n;
  return MEMENTO_QUESTIONS[index];
}
