import { cn } from '../lib/cn';
import { InsightPeriod, INSIGHT_PERIOD_OPTIONS } from '../utils/insightPeriod';

interface InsightPeriodFilterProps {
  value: InsightPeriod;
  onChange: (period: InsightPeriod) => void;
  className?: string;
}

// Shared by Stats, Amor Fati, Passions & Judgments, and Spheres of Choice —
// was 4 near-identical copies of this pill row, one per screen.
export default function InsightPeriodFilter({ value, onChange, className }: InsightPeriodFilterProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-md bg-background-tertiary p-1 border border-tertiary w-full sm:w-auto overflow-x-auto',
        className
      )}
    >
      {INSIGHT_PERIOD_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-3 py-1 text-xs font-medium rounded-sm transition-all text-center flex-1 sm:flex-none whitespace-nowrap',
            value === opt.value
              ? 'bg-background-secondary text-text-primary shadow-sm border border-tertiary'
              : 'text-text-secondary hover:text-text-primary border border-transparent'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
