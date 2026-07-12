import { cn } from '../lib/cn';

export interface StreakCounterProps extends React.HTMLAttributes<HTMLDivElement> {
  count: number;
  label?: string;
}

export function StreakCounter({ count, label = 'Reflection Streak', className, ...props }: StreakCounterProps) {
  return (
    <div className={cn("flex items-center justify-center sm:justify-start gap-4 rounded-xl border border-tertiary bg-background-secondary p-5 shadow-sm w-full", className)} {...props}>
      <span className="text-4xl drop-shadow-sm" role="img" aria-label="streak fire">🔥</span>
      <div className="flex flex-col">
        <span className="font-display text-2xl font-bold text-text-primary leading-none mb-1">{count}</span>
        <span className="text-sm font-medium text-text-secondary">{count === 1 ? `${label} (1 day)` : `${label} (${count} days)`}</span>
      </div>
    </div>
  );
}
