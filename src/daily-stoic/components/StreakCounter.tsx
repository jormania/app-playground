import { cn } from '../lib/cn';
import { Flame } from 'lucide-react';

export interface StreakCounterProps extends React.HTMLAttributes<HTMLDivElement> {
  count: number;
  label?: string;
}

export function StreakCounter({ count, label = 'Reflection Streak', className, ...props }: StreakCounterProps) {
  return (
    <div className={cn("flex items-center justify-center sm:justify-start gap-4 rounded-xl border border-tertiary bg-background-secondary p-5 shadow-sm w-full", className)} {...props}>
      <div className="flex items-center gap-2">
        <Flame size={20} className="text-energy" strokeWidth={2.5} />
        <span className="font-display text-2xl font-semibold leading-none text-text-primary">{count}</span>
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-medium text-text-secondary">{count === 1 ? `${label} (1 day)` : `${label} (${count} days)`}</span>
      </div>
    </div>
  );
}
