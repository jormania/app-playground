import { Skull } from 'lucide-react';
import { Button } from '../../ds';
import { lifeProgress, questionForDay } from '../utils/lifetime';

interface MementoMoriBarProps {
  birthDateString: string;
  /** The app's cycle day — rotates the question underneath the bar. */
  dayOfYear: number;
  onGoToSettings: () => void;
}

/** Memento Mori as a header band: the whole 80-year lifespan as one bar, the
 *  weeks lived, and a question that changes daily. Read-only by design — in
 *  Lite this frames the writing rather than being a step to walk through. */
export default function MementoMoriBar({ birthDateString, dayOfYear, onGoToSettings }: MementoMoriBarProps) {
  const progress = lifeProgress(birthDateString);

  if (!progress) {
    return (
      <section
        className="rounded-xl border border-tertiary border-dashed bg-background-secondary p-4 text-center"
        aria-label="Memento Mori"
      >
        <p className="text-sm text-text-secondary mb-3 flex items-center justify-center gap-2">
          <Skull size={16} aria-hidden="true" />
          Set your birth date to see your life in weeks.
        </p>
        <Button onClick={onGoToSettings} size="sm">Configure Birth Date</Button>
      </section>
    );
  }

  const { weeksLived, totalWeeks, percentage } = progress;

  return (
    <section
      className="rounded-xl border border-secondary bg-background-secondary px-4 py-4 sm:px-6 shadow-sm"
      aria-label="Memento Mori"
    >
      <p className="flex items-center gap-2 text-sm text-text-secondary">
        <Skull size={16} className="text-text-secondary" aria-hidden="true" />
        <span>
          <strong className="text-text-primary">{weeksLived.toLocaleString()}</strong> of{' '}
          {totalWeeks.toLocaleString()} weeks lived
          <span className="text-text-secondary"> · {percentage.toFixed(1)}%</span>
        </span>
      </p>

      <div
        className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-background-tertiary border border-tertiary"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={totalWeeks}
        aria-valuenow={weeksLived}
        aria-label="Lifespan elapsed"
      >
        <div className="h-full rounded-full bg-text-primary" style={{ width: `${percentage}%` }} />
      </div>

      <p className="mt-3 text-sm italic text-text-secondary">{questionForDay(dayOfYear)}</p>
    </section>
  );
}
