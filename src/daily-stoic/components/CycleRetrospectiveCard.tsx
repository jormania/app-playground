import { CycleRetrospective } from '../utils/retrospective';

interface CycleRetrospectiveCardProps {
  retrospective: CycleRetrospective;
}

// The four-box stats grid used both by App.tsx's end-of-cycle celebration
// screen and the Digest's per-cycle entries — see computeCycleRetrospective
// in utils/retrospective.ts for how the numbers are derived.
export default function CycleRetrospectiveCard({ retrospective }: CycleRetrospectiveCardProps) {
  const { loggedCount, consistencyRate, reframingsCount, passionsCount, worriesStats } = retrospective;

  return (
    <div className="grid grid-cols-2 gap-3.5 text-left">
      <div className="p-4 rounded-xl border border-tertiary bg-background-tertiary">
        <span className="text-[10px] uppercase font-mono tracking-wider text-text-secondary">Consistency Rate</span>
        <p className="text-2xl font-semibold text-accent mt-0.5">{consistencyRate}%</p>
        <p className="text-[11px] text-text-secondary mt-1">{loggedCount} of 28 days logged</p>
      </div>

      <div className="p-4 rounded-xl border border-tertiary bg-background-tertiary">
        <span className="text-[10px] uppercase font-mono tracking-wider text-text-secondary">Amor Fati Reframes</span>
        <p className="text-2xl font-semibold text-energy mt-0.5">{reframingsCount}</p>
        <p className="text-[11px] text-text-secondary mt-1">Frictions converted to fuel</p>
      </div>

      <div className="p-4 rounded-xl border border-tertiary bg-background-tertiary">
        <span className="text-[10px] uppercase font-mono tracking-wider text-text-secondary">Concerns Resolved</span>
        <p className="text-2xl font-semibold text-success mt-0.5">{worriesStats.rate}%</p>
        <p className="text-[11px] text-text-secondary mt-1">{worriesStats.resolved} of {worriesStats.total} worries cleared</p>
      </div>

      <div className="p-4 rounded-xl border border-tertiary bg-background-tertiary">
        <span className="text-[10px] uppercase font-mono tracking-wider text-text-secondary">Citadel Vigilance</span>
        <p className="text-2xl font-semibold text-text-primary mt-0.5">{passionsCount}</p>
        <p className="text-[11px] text-text-secondary mt-1">Dysfunctional passions tamed</p>
      </div>
    </div>
  );
}
