import { ReflectionRecord } from '../services/NotionService';
import { getCycleInfo, WEEK_VIRTUES, WeekVirtue } from './date';

// Same 5-point scale as Journal.tsx's mood picker (Great..Awful). Averaging
// this is plain arithmetic on ordinal survey data, not an interpretive
// judgment — Stats states the number, it doesn't say what to do about it.
const MOOD_SCORES: Record<string, number> = {
  Great: 5,
  Good: 4,
  Neutral: 3,
  Bad: 2,
  Awful: 1,
};

export interface VirtueWeekStats {
  virtue: WeekVirtue;
  week: number;
  totalDays: number;
  loggedDays: number;
  consistencyRate: number;
  avgMood: number | null;
  favoritesCount: number;
}

// Aggregates every day of history (not just the current cycle) into its
// virtue-week slot (1-4), regardless of which cycle it belongs to — answers
// "how do I engage with Wisdom weeks vs. Temperance weeks overall," which no
// single-cycle view (Digest's per-cycle retrospective) can show.
export function computeVirtueWeekStats(reflections: ReflectionRecord[], today: number): VirtueWeekStats[] {
  const byDay = new Map<number, ReflectionRecord>();
  reflections.forEach((r) => byDay.set(r.quoteId, r));

  const buckets = WEEK_VIRTUES.map((virtue, idx) => ({
    virtue,
    week: idx + 1,
    totalDays: 0,
    loggedDays: 0,
    moodSum: 0,
    moodCount: 0,
    favoritesCount: 0,
  }));

  for (let day = 1; day <= today; day++) {
    const info = getCycleInfo(day);
    const bucket = buckets[info.week - 1];
    bucket.totalDays++;

    const r = byDay.get(day);
    if (!r) continue;

    bucket.loggedDays++;
    if (r.mood && MOOD_SCORES[r.mood] != null) {
      bucket.moodSum += MOOD_SCORES[r.mood];
      bucket.moodCount++;
    }
    if (r.favorite) bucket.favoritesCount++;
  }

  return buckets.map((b) => ({
    virtue: b.virtue,
    week: b.week,
    totalDays: b.totalDays,
    loggedDays: b.loggedDays,
    consistencyRate: b.totalDays > 0 ? Math.round((b.loggedDays / b.totalDays) * 100) : 0,
    avgMood: b.moodCount > 0 ? Math.round((b.moodSum / b.moodCount) * 10) / 10 : null,
    favoritesCount: b.favoritesCount,
  }));
}

export interface WeekdayStat {
  label: string;
  count: number;
  percentage: number;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Share of a (typically period-filtered) set of reflections that fall on
// each calendar weekday — a plain distribution, same shape as the existing
// tag/mood distribution charts, just keyed by day-of-week instead.
export function computeWeekdayStats(reflections: ReflectionRecord[]): WeekdayStat[] {
  const counts = new Array(7).fill(0);
  let total = 0;
  reflections.forEach((r) => {
    if (!r.date) return;
    const d = new Date(r.date + 'T00:00:00');
    if (Number.isNaN(d.getTime())) return;
    counts[d.getDay()]++;
    total++;
  });

  return WEEKDAY_LABELS.map((label, idx) => ({
    label,
    count: counts[idx],
    percentage: total > 0 ? Math.round((counts[idx] / total) * 100) : 0,
  }));
}

export interface CycleHeatmapDay {
  day: number;
  dayOfWeek: number;
  week: number;
  logged: boolean;
  favorited: boolean;
  isFuture: boolean;
}

// A 28-cell grid (4 weeks × 7 days) for the cycle currently in progress —
// scoped to one cycle (not all-time) so the grid stays a fixed, legible size
// regardless of how long the history grows.
export function computeCurrentCycleHeatmap(reflections: ReflectionRecord[], today: number): CycleHeatmapDay[] {
  const byDay = new Map<number, ReflectionRecord>();
  reflections.forEach((r) => byDay.set(r.quoteId, r));

  const cycle = getCycleInfo(today).cycle;
  const firstDay = (cycle - 1) * 28 + 1;

  const days: CycleHeatmapDay[] = [];
  for (let day = firstDay; day < firstDay + 28; day++) {
    const info = getCycleInfo(day);
    const r = byDay.get(day);
    days.push({
      day,
      dayOfWeek: info.dayOfWeek,
      week: info.week,
      logged: !!r,
      favorited: !!r?.favorite,
      isFuture: day > today,
    });
  }
  return days;
}
