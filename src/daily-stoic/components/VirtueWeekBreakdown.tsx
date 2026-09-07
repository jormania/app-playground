import { Lightbulb, Swords, Gavel, Anchor, Star, type LucideIcon } from 'lucide-react';
import { VirtueWeekStats } from '../utils/stats';
import { moodForScore } from '../data/moods';

const VIRTUE_ICONS: Record<string, LucideIcon> = {
  Wisdom: Lightbulb,
  Courage: Swords,
  Justice: Gavel,
  Temperance: Anchor,
};

interface VirtueWeekBreakdownProps {
  stats: VirtueWeekStats[];
}

// Pure numbers only — no "focus on X" advice. That framing belongs on the
// dashboards (Amor Fati, Passions, Spheres of Choice); Stats just reports.
export default function VirtueWeekBreakdown({ stats }: VirtueWeekBreakdownProps) {
  return (
    <div className="rounded-xl bg-background-secondary border border-tertiary p-6">
      <h3 className="font-display text-xl text-text-primary mb-1 flex items-center gap-2">
        🏛️ Virtue Week Breakdown
      </h3>
      <p className="text-sm text-text-secondary mb-6">
        Each 7-day week of the cycle carries one of the four virtues as its theme, in fixed order.
        This is your consistency and mood <em>inside</em> those weeks, across every cycle — not the
        virtue you pick in the evening.
      </p>
      {/* No min-width: the table has to fit a phone. Favourites are the least
          telling column here (Stats has an all-time tally of its own), so they
          step aside on a narrow screen rather than pushing the numbers off the
          edge, where "Avg Mood 3 / 5" once read as a bare "AVG 3". */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase font-mono tracking-wider text-text-secondary border-b border-tertiary">
              <th className="pb-2 pr-2 font-medium">Week</th>
              <th className="pb-2 px-1 sm:px-2 font-medium text-right">Consistency</th>
              <th className="pb-2 px-1 sm:px-2 font-medium text-right">Avg mood</th>
              <th className="pb-2 pl-2 font-medium text-right hidden sm:table-cell">Favorites</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => {
              const Icon = VIRTUE_ICONS[s.virtue] ?? Star;
              return (
                <tr key={s.virtue} className="border-b border-tertiary last:border-b-0">
                  <td className="py-2.5 pr-2">
                    <span className="flex items-center gap-2 font-medium text-text-primary">
                      <Icon size={15} className="text-accent shrink-0" />
                      <span>
                        <span className="block text-[10px] uppercase font-mono tracking-wider text-text-secondary leading-none">
                          Week {s.week}
                        </span>
                        {s.virtue}
                      </span>
                    </span>
                  </td>
                  <td className="py-2.5 px-1 sm:px-2 text-right font-mono text-text-secondary whitespace-nowrap">
                    {s.consistencyRate}%{' '}
                    <span className="text-[11px]">
                      ({s.loggedDays}/{s.totalDays})
                    </span>
                  </td>
                  {/* The same five faces as the mood row and the MoodGraph, so
                      an average reads at a glance instead of as a fraction.
                      The exact number stays in the label. */}
                  <td className="py-2.5 px-1 sm:px-2 text-right text-text-secondary whitespace-nowrap">
                    {s.avgMood !== null ? (() => {
                      const mood = moodForScore(s.avgMood);
                      const MoodIcon = mood.Icon;
                      return (
                        <span
                          className="inline-flex justify-end w-full text-text-primary"
                          title={`${mood.value} — ${s.avgMood} / 5 average`}
                          aria-label={`Average mood ${mood.value}, ${s.avgMood} out of 5`}
                          role="img"
                        >
                          <MoodIcon size={18} strokeWidth={2} />
                        </span>
                      );
                    })() : <span className="font-mono">—</span>}
                  </td>
                  <td className="py-2.5 pl-2 text-right font-mono text-text-secondary hidden sm:table-cell">{s.favoritesCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
