import { Star } from 'lucide-react';
import { CycleHeatmapDay } from '../utils/stats';
import { cn } from '../lib/cn';

interface CycleHeatmapProps {
  days: CycleHeatmapDay[];
  cycle: number;
}

const WEEKDAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function CycleHeatmap({ days, cycle }: CycleHeatmapProps) {
  return (
    <div className="rounded-xl bg-background-secondary border border-tertiary p-6">
      <h3 className="font-display text-xl text-text-primary mb-1 flex items-center gap-2">
        🗓️ Current Cycle
      </h3>
      <p className="text-sm text-text-secondary mb-6">Cycle {cycle}'s 28 days at a glance</p>

      <div className="grid grid-cols-7 gap-1.5 mb-2">
        {WEEKDAY_HEADERS.map((label) => (
          <div
            key={label}
            className="text-center text-[10px] uppercase font-mono tracking-wide text-text-secondary"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => (
          <div
            key={d.day}
            title={`Day ${d.day} — ${d.isFuture ? 'upcoming' : d.logged ? 'logged' : 'not logged'}`}
            className={cn(
              'aspect-square rounded-md border flex items-center justify-center',
              d.isFuture
                ? 'border-tertiary bg-background-tertiary'
                : d.logged
                ? 'border-accent bg-accent'
                : 'border-tertiary bg-background-primary'
            )}
          >
            {d.favorited && <Star size={11} className="text-accent-contrast fill-accent-contrast" />}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4 mt-4 text-[10px] text-text-secondary">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-accent border border-accent inline-block" /> Logged
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-background-primary border border-tertiary inline-block" /> Not
          logged
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-background-tertiary border border-tertiary inline-block" />{' '}
          Upcoming
        </span>
      </div>
    </div>
  );
}
