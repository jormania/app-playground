/**
 * One place for "what does this period mean" and "what date is this transaction".
 *
 * Before this module the same period switch lived in Dashboard, TransactionsList and
 * the analytics engine — and they had drifted: the analytics copy silently had no
 * `last_3_months` / `last_6_months` case and fell through to "everything ever".
 */

/** "1st", "2nd", "3rd", "4th"… "21st", "22nd", "23rd", "31st" — the old inline
 * ternary only special-cased 1/2/3 and called every teens-and-up day "th". */
export function ordinal(n) {
  const num = Number(n) || 0;
  const mod100 = num % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${num}th`;
  switch (num % 10) {
    case 1: return `${num}st`;
    case 2: return `${num}nd`;
    case 3: return `${num}rd`;
    default: return `${num}th`;
  }
}

/** Period ids the UI can produce, plus `YYYY-MM` (a month) and `YYYY` (a year). */
export const PERIOD_PRESETS = [
  'this_month',
  'last_month',
  'last_3_months',
  'last_6_months',
  'this_year',
  'all_time',
];

/**
 * Parse a transaction date into a *local* Date at midnight.
 *
 * Notion hands back either a plain `YYYY-MM-DD` or a full ISO timestamp (older
 * subscription rows were written with `toISOString()`), and `new Date('2026-07-01')`
 * is parsed as UTC — which lands on the previous day in western timezones. Taking the
 * date prefix and constructing from parts keeps every comparison in local time.
 * Returns null for missing/unparseable input so callers can skip the row.
 */
export function parseTxDate(value) {
  if (!value) return null;
  const prefix = String(value).slice(0, 10);
  const m = prefix.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** `YYYY-MM-DD` for a Date, in local time (never shifts across a timezone). */
export function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** `YYYY-MM` for a transaction date value (or null). */
export function toMonthKey(value) {
  const d = parseTxDate(value);
  return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` : null;
}

/** Days in the month containing `year`/`monthIndex`. */
export function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * Half-open local date range `[start, end)` for a period id.
 * `all_time` (and anything unrecognised) returns nulls, meaning "no bound".
 */
export function getPeriodRange(period, now = new Date()) {
  const startOfMonth = (offset = 0) => new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const p = period || 'this_month';

  if (p === 'all_time') return { start: null, end: null };
  if (p === 'this_month') return { start: startOfMonth(0), end: startOfMonth(1) };
  if (p === 'last_month') return { start: startOfMonth(-1), end: startOfMonth(0) };
  if (p === 'last_3_months') return { start: startOfMonth(-2), end: startOfMonth(1) };
  if (p === 'last_6_months') return { start: startOfMonth(-5), end: startOfMonth(1) };
  if (p === 'this_year') {
    return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear() + 1, 0, 1) };
  }
  if (/^\d{4}-\d{2}$/.test(p)) {
    const [y, m] = p.split('-').map(Number);
    return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
  }
  if (/^\d{4}$/.test(p)) {
    const y = Number(p);
    return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1) };
  }
  return { start: null, end: null };
}

/**
 * The comparable preceding window for a period — same length, immediately before.
 * `all_time` has no predecessor.
 */
export function getPreviousPeriodRange(period, now = new Date()) {
  const p = period || 'this_month';
  if (p === 'all_time') return { start: null, end: null, comparable: false };

  const startOfMonth = (offset = 0) => new Date(now.getFullYear(), now.getMonth() + offset, 1);

  if (p === 'this_month') {
    // A month in progress is compared against the *same slice* of the previous month,
    // otherwise a partial month always looks like a huge improvement (see audit P1-5).
    const start = startOfMonth(-1);
    const dayCap = Math.min(now.getDate(), daysInMonth(start.getFullYear(), start.getMonth()));
    return {
      start,
      end: new Date(start.getFullYear(), start.getMonth(), dayCap + 1),
      comparable: true,
      partial: true,
    };
  }
  if (p === 'last_month') return { start: startOfMonth(-2), end: startOfMonth(-1), comparable: true };
  if (p === 'last_3_months') return { start: startOfMonth(-5), end: startOfMonth(-2), comparable: true };
  if (p === 'last_6_months') return { start: startOfMonth(-11), end: startOfMonth(-5), comparable: true };
  if (p === 'this_year') {
    return {
      start: new Date(now.getFullYear() - 1, 0, 1),
      end: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate() + 1),
      comparable: true,
      partial: true,
    };
  }
  if (/^\d{4}-\d{2}$/.test(p)) {
    const [y, m] = p.split('-').map(Number);
    return { start: new Date(y, m - 2, 1), end: new Date(y, m - 1, 1), comparable: true };
  }
  if (/^\d{4}$/.test(p)) {
    const y = Number(p);
    return { start: new Date(y - 1, 0, 1), end: new Date(y, 0, 1), comparable: true };
  }
  return { start: null, end: null, comparable: false };
}

/** True when a transaction falls inside a `[start, end)` range (null bounds = open). */
export function inRange(tx, range) {
  if (!range) return true;
  const d = parseTxDate(tx.date);
  if (!d) return false;
  if (range.start && d < range.start) return false;
  if (range.end && d >= range.end) return false;
  return true;
}

/** Filter transactions to a period. */
export function filterByPeriod(transactions, period, now = new Date()) {
  const range = getPeriodRange(period, now);
  if (!range.start && !range.end) return transactions.filter(t => parseTxDate(t.date));
  return transactions.filter(t => inRange(t, range));
}

/** Filter transactions to the window immediately preceding a period. */
export function filterByPreviousPeriod(transactions, period, now = new Date()) {
  const range = getPreviousPeriodRange(period, now);
  if (!range.comparable) return [];
  return transactions.filter(t => inRange(t, range));
}

/** Number of whole months a period spans — used to scale monthly budgets. */
export function monthsInPeriod(period, now = new Date()) {
  const p = period || 'this_month';
  if (p === 'this_month' || p === 'last_month' || /^\d{4}-\d{2}$/.test(p)) return 1;
  if (p === 'last_3_months') return 3;
  if (p === 'last_6_months') return 6;
  if (p === 'this_year') return now.getMonth() + 1;
  if (/^\d{4}$/.test(p)) return 12;
  return null; // all_time / unknown — not scalable
}

/** Human label for a period, used in headings and the nav button. */
export function formatPeriodLabel(period, now = new Date(), { short = false } = {}) {
  const p = period || 'this_month';
  const monthFmt = short ? 'short' : 'long';
  if (p === 'this_month') return now.toLocaleDateString(undefined, { month: monthFmt, year: 'numeric' });
  if (p === 'last_month') {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return d.toLocaleDateString(undefined, { month: monthFmt, year: 'numeric' });
  }
  if (p === 'last_3_months') return 'Last 3 months';
  if (p === 'last_6_months') return 'Last 6 months';
  if (p === 'this_year') return String(now.getFullYear());
  if (p === 'all_time') return 'All time';
  if (/^\d{4}-\d{2}$/.test(p)) {
    const [y, m] = p.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: monthFmt, year: 'numeric' });
  }
  if (/^\d{4}$/.test(p)) return p;
  return 'This period';
}
