import { Calendar } from 'lucide-react';
import { WeekdayStat } from '../utils/stats';

interface WeekdayChartProps {
  stats: WeekdayStat[];
}

export default function WeekdayChart({ stats }: WeekdayChartProps) {
  const total = stats.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="rounded-xl bg-background-secondary border border-tertiary p-6 h-full flex flex-col justify-between">
      <div>
        <h3 className="font-display text-xl text-text-primary mb-1 flex items-center gap-2">
          <Calendar size={20} className="text-accent" /> Logging by Day of Week
        </h3>
        <p className="text-sm text-text-secondary mb-6">
          Which weekdays you log on most ({total} total in this period)
        </p>
      </div>

      {total === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed border-tertiary p-6 text-center">
          <p className="text-sm font-medium text-text-secondary">No entries in this period yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {stats.map((s) => (
            <div key={s.label} className="flex items-center gap-3 text-sm">
              <span className="w-10 shrink-0 font-medium text-text-secondary">{s.label}</span>
              <div className="flex flex-1 items-center gap-2">
                <div className="flex-1 h-2.5 overflow-hidden rounded-full bg-background-tertiary border border-tertiary">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out bg-accent"
                    style={{ width: `${s.percentage}%` }}
                  />
                </div>
                <span className="w-20 shrink-0 text-right font-medium font-mono text-text-secondary">
                  {s.count} ({s.percentage}%)
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
