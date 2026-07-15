import { Milestone, Target, HelpCircle } from 'lucide-react';
import { getWeekCurriculum } from '../lib/curriculum';
import { DISCIPLINE_SUMMARY } from '../data/curriculum';

interface PathCardProps {
  week: number;
}

/** Enhance 2 — "This week on the Path". Overlays the cycle's virtue-week with
 *  its Stoic discipline (Desire / Action / Assent), a short teaching, the week's
 *  concrete practice, and a focus question to carry. Pure/offline. */
export default function PathCard({ week }: PathCardProps) {
  const c = getWeekCurriculum(week);
  const disc = DISCIPLINE_SUMMARY[c.discipline];

  return (
    <section className="rounded-xl border border-accent/25 bg-accent-soft p-4 sm:p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        <Milestone size={16} className="text-accent shrink-0" />
        <span className="text-[10px] uppercase font-mono tracking-widest font-semibold text-accent/80">
          The Path · Week {((Math.floor(week) - 1) % 4 + 4) % 4 + 1} of 4
        </span>
        <span className="ml-auto text-[10px] uppercase font-mono tracking-wider text-text-secondary shrink-0">
          Discipline of {c.discipline}
        </span>
      </div>

      <h3 className="font-display text-lg sm:text-xl text-text-primary">{c.title}</h3>
      <p className="text-[11px] text-text-secondary italic mt-0.5 mb-3">
        {c.virtue} · {c.discipline} <span className="not-italic">({disc.greek})</span> — {disc.gloss}
      </p>

      <p className="text-sm text-text-secondary leading-relaxed">{c.teaching}</p>

      <div className="mt-4 rounded-lg border border-tertiary bg-background-secondary/60 p-3 flex items-start gap-2">
        <Target size={15} className="text-accent mt-0.5 shrink-0" />
        <div>
          <span className="text-[10px] uppercase font-mono tracking-wider text-text-secondary block">This week’s practice</span>
          <p className="text-sm text-text-primary leading-relaxed mt-0.5">{c.practice}</p>
        </div>
      </div>

      <p className="mt-3 text-xs text-text-secondary flex items-start gap-1.5 italic">
        <HelpCircle size={13} className="mt-0.5 shrink-0" />
        {c.focusQuestion}
      </p>
    </section>
  );
}
