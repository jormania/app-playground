import AppGuideNote from './AppGuideNote';
import { Button } from './Button';
import { Skull } from 'lucide-react';

interface MementoMoriProps {
  birthDateString: string;
  onGoToSettings: () => void;
}

export default function MementoMori({ birthDateString, onGoToSettings }: MementoMoriProps) {
  if (!birthDateString) {
    return (
      <div className="mx-auto max-w-2xl text-center rounded-xl bg-background-secondary border border-tertiary p-8">
        <h3 className="mb-2 font-display text-2xl text-text-primary flex items-center justify-center gap-2">
          <Skull size={24} className="text-text-secondary" />
          Memento Mori
        </h3>
        <p className="mb-6 text-text-secondary">
          "Remember you must die." A visual representation of your life in weeks.
        </p>
        <div className="mb-6 text-left">
          <AppGuideNote summary="Why meditate on mortality?">
            <p>
              <strong>Memento Mori</strong> is not about being morbid. It's a tool to create urgency, 
              clarify what truly matters, and remind you not to waste the time you have left on trivial arguments or anxieties.
            </p>
          </AppGuideNote>
        </div>
        <div className="rounded-lg border border-tertiary border-dashed p-8 bg-background-secondary/50">
          <p className="mb-4 text-text-primary font-medium">
            Configure your birth date in settings to visualize your Memento Mori life calendar.
          </p>
          <Button onClick={onGoToSettings}>
            ⚙️ Go to Settings
          </Button>
        </div>
      </div>
    );
  }

  const birthDate = new Date(birthDateString);
  const today = new Date();
  
  // Lifespan definition (80 years)
  const totalYears = 80;
  const totalWeeks = totalYears * 52; // 4160 weeks

  // Calculate elapsed weeks
  const diffMs = today.getTime() - birthDate.getTime();
  const weeksElapsed = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7)));
  
  const percentage = Math.min(100, Math.max(0, (weeksElapsed / totalWeeks) * 100));

  // We can group blocks in 80 rows of 52 weeks or render a grid directly.
  // Drawing 4160 blocks in a optimized CSS Grid.
  const blocks = [];
  for (let i = 0; i < totalWeeks; i++) {
    const elapsed = i < weeksElapsed;
    blocks.push(
      <div
        key={i}
        className={`rounded-[1px] sm:rounded-sm aspect-square ${elapsed ? 'bg-text-primary' : 'bg-border-secondary'}`}
        title={`Week ${i + 1} of ${totalWeeks} (${elapsed ? 'Elapsed' : 'Remaining'})`}
      />
    );
  }

  return (
    <div className="mx-auto max-w-4xl rounded-xl bg-background-secondary border border-tertiary p-6 sm:p-8">
      <div className="mb-10 text-center">
        <h3 className="mb-4 font-display text-3xl text-text-primary flex items-center justify-center gap-3">
          <Skull size={28} className="text-text-secondary" />
          Memento Mori
        </h3>
        <p className="text-text-secondary mt-6 leading-relaxed">
          "Let us prepare our minds as if we’d come to the very end of life." — Seneca
        </p>
      </div>

      <div className="mb-6 flex flex-wrap justify-center gap-4 sm:gap-8 text-sm font-medium text-text-secondary">
        <span className="rounded-full bg-background-tertiary px-4 py-2 border border-tertiary">
          Weeks elapsed: <strong className="text-text-primary">{weeksElapsed}</strong> / {totalWeeks}
        </span>
        <span className="rounded-full bg-background-tertiary px-4 py-2 border border-tertiary">
          Life progress: <strong className="text-text-primary">{percentage.toFixed(1)}%</strong>
        </span>
      </div>

      <div className="flex justify-center mb-6 overflow-x-auto overflow-y-hidden">
        <div 
          className="grid gap-0.5 p-2 sm:p-4 rounded-lg bg-background-tertiary border border-tertiary mx-auto w-[326px] sm:w-[446px]"
          style={{ gridTemplateColumns: 'repeat(52, minmax(0, 1fr))' }}
        >
          {blocks}
        </div>
      </div>

      <p className="text-center text-sm text-text-secondary mt-8">
        Each block represents one week of an 80-year lifespan. Live today as if it were a gift.
      </p>
    </div>
  );
}
