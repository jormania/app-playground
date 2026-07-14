import { cn } from '../lib/cn';
import { Flame } from 'lucide-react';

export interface StreakCounterProps extends React.HTMLAttributes<HTMLDivElement> {
  count: number;
  label?: string;
}

export function StreakCounter({ count, label = 'Reflection Streak', className, ...props }: StreakCounterProps) {
  return (
    <div className={cn("flex items-center justify-center sm:justify-start gap-4 rounded-xl border border-tertiary bg-background-secondary p-5 shadow-sm w-full", className)} {...props}>
      <div className="flex items-baseline gap-1.5">
        <Flame size={20} className="text-energy shrink-0 self-center" strokeWidth={2.5} />
        <span className="font-display text-2xl font-semibold leading-none text-text-primary">{count}</span>
        <span className="text-xs text-text-secondary">{count === 1 ? 'day' : 'days'}</span>
      </div>
      <div className="flex flex-col">
        <span className="text-sm font-medium text-text-secondary">{label}</span>
      </div>
    </div>
  );
}
