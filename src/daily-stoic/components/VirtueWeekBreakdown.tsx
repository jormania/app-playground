import { Lightbulb, Swords, Gavel, Anchor, Star, type LucideIcon } from 'lucide-react';
import { VirtueWeekStats } from '../utils/stats';

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
        Consistency, mood, and favorites by virtue-week theme, across every cycle
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[420px]">
          <thead>
            <tr className="text-left text-[10px] uppercase font-mono tracking-wider text-text-secondary border-b border-tertiary">
              <th className="pb-2 pr-2 font-medium">Virtue</th>
              <th className="pb-2 px-2 font-medium text-right">Consistency</th>
              <th className="pb-2 px-2 font-medium text-right">Avg Mood</th>
              <th className="pb-2 pl-2 font-medium text-right">Favorites</th>
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
                      {s.virtue}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-text-secondary">
                    {s.consistencyRate}%{' '}
                    <span className="text-[11px]">
                      ({s.loggedDays}/{s.totalDays})
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono text-text-secondary">
                    {s.avgMood !== null ? `${s.avgMood} / 5` : '—'}
                  </td>
                  <td className="py-2.5 pl-2 text-right font-mono text-text-secondary">{s.favoritesCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
