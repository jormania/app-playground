import { useMemo } from 'react';
import { StreakCounter } from '../../ds';
import MoodGraph from './MoodGraph';
import WeekdayChart from './WeekdayChart';
import VirtueWeekBreakdown from './VirtueWeekBreakdown';
import CycleHeatmap from './CycleHeatmap';
import InsightPeriodFilter from './InsightPeriodFilter';
import { ReflectionRecord } from '../services/NotionService';
import { getCycleInfo } from '../utils/date';
import { calculateLongestStreak } from '../utils/streak';
import { computeVirtueWeekStats, computeWeekdayStats, computeCurrentCycleHeatmap } from '../utils/stats';
import { getInsightPeriodRange } from '../utils/insightPeriod';
import { useInsightPeriod } from '../lib/useInsightPeriod';

interface StatsProps {
  streak: number;
  today: number;
  cycleStartDate: string;
  reflections: ReflectionRecord[];
  loading: boolean;
  onClose: () => void;
}

export default function Stats({ streak, today, cycleStartDate, reflections, loading, onClose }: StatsProps) {
  const [insightPeriod, setInsightPeriod] = useInsightPeriod();

  const periodRange = useMemo(
    () => getInsightPeriodRange(insightPeriod, cycleStartDate, today),
    [insightPeriod, cycleStartDate, today]
  );

  // Filter reflections to the selected period, by actual calendar date
  const filteredReflections = useMemo(() => {
    if (!periodRange) return reflections;
    return reflections.filter((r) => r.date >= periodRange.start && r.date <= periodRange.end);
  }, [reflections, periodRange]);

  // Period totals — plain counts and rates, no interpretation. Amor Fati,
  // Passions & Judgments, and Spheres of Choice each own the "here's what it
  // means" framing for their own data; this screen only reports numbers.
  const totals = useMemo(() => {
    const periodDays = periodRange ? periodRange.totalDays : today;

    let words = 0;
    let premeditatioCount = 0;
    const moods: Record<string, number> = {};

    filteredReflections.forEach(r => {
      if (r.text) words += r.text.trim().split(/\s+/).length;
      if (r.mood) moods[r.mood] = (moods[r.mood] || 0) + 1;
      if (r.morningIntentions && r.morningIntentions.trim()) premeditatioCount++;
    });

    const dominantMood = Object.entries(moods).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';
    const count = filteredReflections.length;

    return {
      words,
      dominantMood,
      count,
      periodDays,
      premeditatioCount,
      premeditatioRate: count > 0 ? Math.round((premeditatioCount / count) * 100) : 0,
    };
  }, [filteredReflections, periodRange, today]);

  // The rest of these are all-time (not period-scoped) — they're about the
  // whole history, the same way "Cycles Completed" wouldn't make sense
  // limited to the last 30 days.
  const longestStreak = useMemo(
    () => calculateLongestStreak(new Set(reflections.map((r) => r.quoteId))),
    [reflections]
  );
  const currentCycle = useMemo(() => getCycleInfo(today).cycle, [today]);
  const cyclesCompleted = currentCycle - 1;
  const totalFavorites = useMemo(() => reflections.filter((r) => r.favorite).length, [reflections]);
  const virtueWeekStats = useMemo(() => computeVirtueWeekStats(reflections, today), [reflections, today]);
  const weekdayStats = useMemo(() => computeWeekdayStats(filteredReflections), [filteredReflections]);
  const currentCycleHeatmap = useMemo(
    () => computeCurrentCycleHeatmap(reflections, today),
    [reflections, today]
  );

  return (
    <div className="mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-6 sm:mb-12 flex items-center justify-between border-b border-tertiary pb-4 sm:pb-8">
        <div>
          <h2 className="font-display text-xl sm:text-2xl text-text-primary mb-2 sm:mb-4">Your Progress</h2>
          <p className="text-sm text-text-secondary mt-1 sm:mt-2">Consistency and alignment metrics</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-2 text-text-secondary hover:bg-background-tertiary transition-colors"
          title="Close Stats"
        >
          ✕
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-tertiary p-12 text-center bg-background-secondary text-sm text-text-secondary">
          Loading your full history…
        </div>
      ) : (
        <>
          <div className="mb-8 grid gap-4 grid-cols-1 sm:grid-cols-2">
            <div className="rounded-lg bg-background-secondary border border-tertiary p-6 flex flex-col justify-center">
              <StreakCounter count={streak} />
            </div>

            {/* Period Totals */}
            <div className="rounded-lg bg-background-secondary border border-tertiary p-4 sm:p-5">
              <div className="flex items-center justify-end mb-4 sm:mb-6">
                <InsightPeriodFilter value={insightPeriod} onChange={setInsightPeriod} className="max-w-full" />
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center border-b border-tertiary pb-2">
                  <span className="text-text-secondary">Days Journaled</span>
                  <span className="font-medium text-text-primary">{totals.count} / {totals.periodDays}</span>
                </div>
                <div className="flex justify-between items-center border-b border-tertiary pb-2">
                  <span className="text-text-secondary">Dominant Mood</span>
                  <span className="font-medium text-text-primary">{totals.dominantMood}</span>
                </div>
                <div className="flex justify-between items-center border-b border-tertiary pb-2">
                  <span className="text-text-secondary">Premeditatio Malorum</span>
                  <span className="font-medium text-text-primary">
                    {totals.premeditatioRate}% ({totals.premeditatioCount}/{totals.count})
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary">Words Written</span>
                  <span className="font-medium text-text-primary">{totals.words.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* All-Time Tallies */}
          <div className="mb-6 sm:mb-8 grid gap-4 grid-cols-1 sm:grid-cols-3">
            <div className="rounded-lg bg-background-secondary border border-tertiary p-4 text-center">
              <span className="text-[10px] uppercase font-mono tracking-wider text-text-secondary block mb-1">
                Cycles Completed
              </span>
              <span className="text-2xl font-display font-semibold text-text-primary">{cyclesCompleted}</span>
            </div>
            <div className="rounded-lg bg-background-secondary border border-tertiary p-4 text-center">
              <span className="text-[10px] uppercase font-mono tracking-wider text-text-secondary block mb-1">
                Longest Streak
              </span>
              <span className="text-2xl font-display font-semibold text-text-primary">
                {longestStreak} {longestStreak === 1 ? 'day' : 'days'}
              </span>
            </div>
            <div className="rounded-lg bg-background-secondary border border-tertiary p-4 text-center">
              <span className="text-[10px] uppercase font-mono tracking-wider text-text-secondary block mb-1">
                Favorited Quotes
              </span>
              <span className="text-2xl font-display font-semibold text-text-primary">{totalFavorites}</span>
            </div>
          </div>

          <div className="mb-6 sm:mb-8">
            <VirtueWeekBreakdown stats={virtueWeekStats} />
          </div>

          <div className="mb-6 sm:mb-8 grid gap-4 grid-cols-1 sm:grid-cols-2">
            <WeekdayChart stats={weekdayStats} />
            <MoodGraph records={filteredReflections} />
          </div>

          <div className="mb-6 sm:mb-8">
            <CycleHeatmap days={currentCycleHeatmap} cycle={currentCycle} />
          </div>
        </>
      )}
    </div>
  );
}
