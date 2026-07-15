import { ReflectionRecord } from '../services/NotionService';
import { cycleDayToDateStr } from './date';

// Mirrors the local `Worry` shape defined in App.tsx/Journal.tsx/DichotomyOfControl.tsx
// (not centralized there either) — structurally compatible, so callers can pass their
// existing worries array straight through.
export interface Worry {
  id: string;
  text: string;
  category: 'unassigned' | 'up-to-me' | 'not-up-to-me';
  isResolved?: boolean;
  createdAt?: string;
}

// Each day's Notion reflection page stores a full snapshot of the worries
// list as of that save (not just that day's new ones), so recovering the
// true worry list means de-duping by id across every reflection rather than
// reading any single page. Works the same whether `reflections` is the
// windowed ~100-record fetch or the full history — callers decide which.
export function extractWorriesFromReflections(reflections: ReflectionRecord[]): Worry[] {
  const worries: Worry[] = [];
  const seenIds = new Set<string>();
  reflections.forEach((rec) => {
    if (!rec.dichotomy) return;
    try {
      const list: Worry[] = JSON.parse(rec.dichotomy);
      list.forEach((w) => {
        if (w && w.id && !seenIds.has(w.id)) {
          seenIds.add(w.id);
          worries.push(w);
        }
      });
    } catch {}
  });
  return worries;
}

export interface CycleRetrospective {
  cycleNumber: number;
  dateRange: { start: string; end: string };
  loggedCount: number;
  consistencyRate: number;
  reframingsCount: number;
  passionsCount: number;
  worriesStats: { total: number; resolved: number; rate: number };
}

// Pure, reusable version of the stats block App.tsx's celebration screen computes for
// "the most recently completed cycle" — this works for ANY cycle number, so it also
// backs the Digest's per-cycle retrospective and its "View full retrospective" link.
export function computeCycleRetrospective(
  cycleNumber: number,
  cycleStartDate: string,
  reflections: ReflectionRecord[],
  worries: Worry[]
): CycleRetrospective {
  const firstDay = (cycleNumber - 1) * 28 + 1;
  const lastDay = cycleNumber * 28;
  const dateRange = {
    start: cycleDayToDateStr(firstDay, cycleStartDate),
    end: cycleDayToDateStr(lastDay, cycleStartDate),
  };

  const cycleReflections = reflections.filter(
    (r) => r.date >= dateRange.start && r.date <= dateRange.end
  );

  const loggedCount = cycleReflections.length;
  const consistencyRate = Math.min(100, Math.round((loggedCount / 28) * 100));
  const reframingsCount = cycleReflections.filter((r) => r.fateInput && r.fateInput.trim()).length;
  const passionsCount = cycleReflections.reduce((count, r) => count + (r.passions || []).length, 0);

  const cycleWorries = worries.filter((w) => {
    if (!w.createdAt) return true;
    return w.createdAt >= dateRange.start && w.createdAt <= dateRange.end;
  });
  const resolved = cycleWorries.filter((w) => w.isResolved).length;
  const total = cycleWorries.length;

  return {
    cycleNumber,
    dateRange,
    loggedCount,
    consistencyRate,
    reframingsCount,
    passionsCount,
    worriesStats: { total, resolved, rate: total > 0 ? Math.round((resolved / total) * 100) : 0 },
  };
}
