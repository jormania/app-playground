import { useMemo, useState } from 'react';
import { Handshake, Check, X, Flame, Info, Compass, Clock } from 'lucide-react';
import { ReflectionRecord } from '../services/NotionService';
import { AVAILABLE_PASSIONS } from '../data/passions';
import { cn } from '../lib/cn';
import InsightPeriodFilter from './InsightPeriodFilter';
import MentorPanel from './MentorPanel';
import { getInsightPeriodRange } from '../utils/insightPeriod';
import { getCycleInfo, formatCycleLabelCompact } from '../utils/date';
import { useInsightPeriod } from '../lib/useInsightPeriod';
import { useCommitments } from '../lib/useCommitments';
import { useMentorEnabled } from '../lib/useMentor';
import {
  Commitment,
  commitmentsInDayRange,
  ledgerStats,
  keptStreak,
} from '../lib/commitments';
import { buildPatternInterventionPrompt, type MentorPrompt } from '../lib/mentor';

interface CommitmentsDashboardProps {
  reflections: ReflectionRecord[];
  today: number;
  cycleStartDate: string;
  onClose: () => void;
  onGoToSettings: () => void;
}

// A small, self-contained sample so a brand-new practitioner (or anyone on day 3)
// can see what the ledger becomes — the same "Demo Mode" affordance the other
// dashboards offer. Never persisted; purely illustrative.
const DEMO_COMMITMENTS: Commitment[] = [
  { id: 'd1', text: 'Answer the difficult email before noon, without complaint', createdDay: 1, createdAt: '', status: 'kept', resolvedDay: 1, source: 'self' },
  { id: 'd2', text: 'Sit with the gym resistance for five minutes, then decide', createdDay: 2, createdAt: '', status: 'broken', resolvedDay: 2, note: 'Told myself I was too tired', source: 'self' },
  { id: 'd3', text: 'Say the hard truth to my colleague, kindly', createdDay: 3, createdAt: '', status: 'kept', resolvedDay: 3, source: 'mentor' },
  { id: 'd4', text: 'No phone for the first hour of the morning', createdDay: 4, createdAt: '', status: 'kept', resolvedDay: 4, source: 'self' },
  { id: 'd5', text: 'Finish the report I keep postponing', createdDay: 5, createdAt: '', status: 'broken', resolvedDay: 5, source: 'self' },
  { id: 'd6', text: 'Walk instead of scroll at lunch', createdDay: 6, createdAt: '', status: 'kept', resolvedDay: 6, source: 'self' },
];

const STATUS_META: Record<Commitment['status'], { label: string; cls: string }> = {
  kept: { label: 'Kept', cls: 'text-success' },
  broken: { label: 'Broke it', cls: 'text-energy' },
  open: { label: 'Open', cls: 'text-text-secondary' },
};

export default function CommitmentsDashboard({
  reflections,
  today,
  cycleStartDate,
  onClose,
  onGoToSettings,
}: CommitmentsDashboardProps) {
  const [insightPeriod, setInsightPeriod] = useInsightPeriod();
  const [demoMode, setDemoMode] = useState(false);
  const { commitments } = useCommitments();
  const mentorEnabled = useMentorEnabled();

  const periodRange = useMemo(
    () => getInsightPeriodRange(insightPeriod, cycleStartDate, today),
    [insightPeriod, cycleStartDate, today],
  );

  const realScoped = useMemo(() => {
    const startDay = periodRange ? periodRange.startDay : 1;
    return commitmentsInDayRange(commitments, startDay, today);
  }, [commitments, periodRange, today]);

  const scoped = demoMode ? DEMO_COMMITMENTS : realScoped;
  const stats = useMemo(() => ledgerStats(scoped), [scoped]);
  const streak = useMemo(
    () => (demoMode ? 1 : keptStreak(commitments)),
    [demoMode, commitments],
  );
  const hasData = stats.kept + stats.broken > 0;

  // Newest-first history (by day made), for the timeline below.
  const history = useMemo(
    () => [...scoped].sort((a, b) => b.createdDay - a.createdDay),
    [scoped],
  );

  // Cross-reference: the passions the practitioner most often admits to in this
  // same span — so the mentor can tie a broken promise to the passion behind it.
  const topPassions = useMemo(() => {
    if (demoMode) {
      return [
        { label: 'Craving & Attachment', count: 4 },
        { label: 'Discontent & Self-Pity', count: 2 },
      ];
    }
    const counts: Record<string, number> = {};
    reflections.forEach((r) => {
      if (!r.date) return;
      if (periodRange && (r.date < periodRange.start || r.date > periodRange.end)) return;
      (r.passions || []).forEach((id) => {
        const label = AVAILABLE_PASSIONS.find((p) => p.id === id)?.label || id;
        counts[label] = (counts[label] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [reflections, periodRange, demoMode]);

  const patternPrompt = useMemo<MentorPrompt | null>(() => {
    if (!hasData && topPassions.length === 0) return null;
    const recentBroken = history
      .filter((c) => c.status === 'broken')
      .slice(0, 3)
      .map((c) => c.text);
    return buildPatternInterventionPrompt({
      span: periodRange ? `the last ${periodRange.totalDays} days` : 'their whole practice',
      topPassions,
      keptRate: stats.keptRate,
      reckonedCount: stats.kept + stats.broken,
      recentBroken,
    });
  }, [hasData, topPassions, history, periodRange, stats]);

  return (
    <div className="mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between border-b border-tertiary pb-6">
        <div>
          <h2 className="font-display text-2xl text-text-primary flex items-center gap-2">
            <Handshake size={24} className="text-accent" />
            Commitments
          </h2>
          <p className="text-sm text-text-secondary mt-1">
            Promises made, and honestly reckoned — the ledger of your word to yourself
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-2 text-text-secondary hover:bg-background-tertiary transition-colors"
          title="Close Commitments"
        >
          ✕
        </button>
      </div>

      {/* Intro Quote */}
      <blockquote className="rounded-lg bg-background-secondary p-5 border border-tertiary italic text-sm text-text-secondary mb-8 leading-relaxed">
        "We should every night call ourselves to account: what infirmity have I mastered today? what
        passion opposed? what temptation resisted? what virtue acquired?"
        <cite className="block text-right not-italic text-xs font-semibold mt-2 text-text-primary">— Seneca, On Anger</cite>
      </blockquote>

      {/* Controls & Demo Toggle */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-6">
        <InsightPeriodFilter value={insightPeriod} onChange={setInsightPeriod} />
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <label htmlFor="ledger-demo-toggle" className="text-xs text-text-secondary font-medium">Demo Mode</label>
          <button
            id="ledger-demo-toggle"
            onClick={() => setDemoMode(!demoMode)}
            className={cn(
              'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none',
              demoMode ? 'bg-accent' : 'bg-background-tertiary border-tertiary',
            )}
            role="switch"
            aria-checked={demoMode}
          >
            <span
              className={cn(
                'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-text-primary shadow ring-0 transition duration-200 ease-in-out',
                demoMode ? 'translate-x-5 bg-background-primary' : 'translate-x-0',
              )}
            />
          </button>
        </div>
      </div>

      {!hasData ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-tertiary p-12 text-center bg-background-secondary">
          <div className="h-16 w-16 rounded-full bg-accent/5 flex items-center justify-center text-accent mb-4 border border-accent/20">
            <Handshake size={32} className="text-accent" />
          </div>
          <h3 className="font-display text-xl text-text-primary mb-2">No promises reckoned yet</h3>
          <p className="text-sm text-text-secondary max-w-sm mb-6 leading-relaxed">
            In the morning’s <strong className="text-text-primary">Prepare</strong> step, make one provable
            promise; in the evening’s <strong className="text-text-primary">Reflect</strong> step, reckon it
            kept or broken. Your ledger fills in from there.
          </p>
          <button
            onClick={() => setDemoMode(true)}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background-primary hover:bg-accent-hover transition-colors"
          >
            See Demo Ledger
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Metric cards */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            <div className="rounded-xl border border-tertiary bg-background-secondary p-5 flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-widest font-semibold text-text-secondary block">Word kept</span>
                <h4 className="font-display text-lg text-text-primary mt-1 flex items-center gap-2">🤝 Kept Rate</h4>
              </div>
              <div className="my-4 flex items-center gap-4">
                <div className="text-4xl font-display font-bold text-accent">{stats.keptRate}%</div>
                <div className="text-xs text-text-secondary leading-relaxed">
                  You kept <strong className="text-text-primary">{stats.kept}</strong> of the{' '}
                  <strong className="text-text-primary">{stats.kept + stats.broken}</strong> promises you reckoned.
                </div>
              </div>
              <div className="text-[10px] text-text-secondary/60 flex items-center gap-1.5 border-t border-tertiary/60 pt-2">
                <Info size={12} /> Measures how reliably you keep your word to yourself.
              </div>
            </div>

            <div className="rounded-xl border border-tertiary bg-background-secondary p-5 flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-widest font-semibold text-text-secondary block">Momentum</span>
                <h4 className="font-display text-lg text-text-primary mt-1 flex items-center gap-2">🔥 Kept Streak</h4>
              </div>
              <div className="my-4 flex items-center gap-4">
                <div className="text-4xl font-display font-bold text-accent flex items-center gap-2">
                  <Flame size={28} className="text-accent" />
                  {streak}
                </div>
                <div className="text-xs text-text-secondary leading-relaxed">
                  Consecutive promises kept, counting back from your most recent reckoning.
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 border-t border-tertiary/60 pt-3 text-center">
                <div>
                  <div className="text-sm font-bold text-success">{stats.kept}</div>
                  <div className="text-[9px] uppercase font-mono text-text-secondary">Kept</div>
                </div>
                <div>
                  <div className="text-sm font-bold text-energy">{stats.broken}</div>
                  <div className="text-[9px] uppercase font-mono text-text-secondary">Broken</div>
                </div>
                <div>
                  <div className="text-sm font-bold text-text-primary">{stats.open}</div>
                  <div className="text-[9px] uppercase font-mono text-text-secondary">Open</div>
                </div>
              </div>
            </div>
          </div>

          {/* Mentor's pattern intervention */}
          {!demoMode && (
            <MentorPanel
              title="The Mentor’s Read"
              intro="Let the mentor name the one pattern in your ledger that matters most — and turn it into a discipline for this week."
              cta="Read my pattern"
              prompt={patternPrompt}
              disabledHint="Reckon a few promises first, then ask the mentor."
              enabled={mentorEnabled}
              onGoToSettings={onGoToSettings}
              icon={Compass}
            />
          )}

          {/* History timeline */}
          <div className="rounded-xl border border-tertiary bg-background-secondary p-5 sm:p-6">
            <h3 className="font-display text-lg text-text-primary mb-1">⌛ The Ledger</h3>
            <p className="text-xs text-text-secondary mb-6 leading-relaxed">
              Every promise, newest first. The record is only as useful as it is honest.
            </p>
            <div className="space-y-3">
              {history.map((c) => {
                const meta = STATUS_META[c.status];
                const info = getCycleInfo(c.createdDay);
                return (
                  <div
                    key={c.id}
                    className="border-b border-tertiary/60 pb-3 last:border-b-0 last:pb-0 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p
                        className={cn(
                          'text-sm leading-snug',
                          c.status === 'broken' ? 'text-text-secondary line-through decoration-tertiary' : 'text-text-primary',
                        )}
                      >
                        {c.text}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-text-secondary/70">
                        <Clock size={10} />
                        {formatCycleLabelCompact(info)}
                        {c.source === 'mentor' && (
                          <span className="text-accent/70 flex items-center gap-0.5">
                            <Compass size={10} /> mentor
                          </span>
                        )}
                        {c.note && <span className="italic truncate">“{c.note}”</span>}
                      </div>
                    </div>
                    <span className={cn('text-[10px] font-semibold uppercase shrink-0 flex items-center gap-1', meta.cls)}>
                      {c.status === 'kept' && <Check size={11} />}
                      {c.status === 'broken' && <X size={11} />}
                      {meta.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
