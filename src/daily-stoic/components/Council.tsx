import { useMemo } from 'react';
import { Users, Milestone, Check, X, Telescope } from 'lucide-react';
import { ReflectionRecord } from '../services/NotionService';
import { AVAILABLE_PASSIONS } from '../data/passions';
import { getCycleInfo } from '../utils/date';
import { getWeekCurriculum } from '../lib/curriculum';
import { DISCIPLINE_SUMMARY } from '../data/curriculum';
import { useCommitments } from '../lib/useCommitments';
import { useMentorEnabled } from '../lib/useMentor';
import { commitmentsInDayRange, ledgerStats } from '../lib/commitments';
import {
  buildCouncilPrompt,
  buildCharacterArcPrompt,
  type MentorPrompt,
  type PatternPassion,
} from '../lib/mentor';
import MentorPanel from './MentorPanel';

interface CouncilProps {
  reflections: ReflectionRecord[];
  today: number;
  cycleStartDate: string;
  loading: boolean;
  onClose: () => void;
  onGoToSettings: () => void;
}

function passionCounts(reflections: ReflectionRecord[]): PatternPassion[] {
  const counts: Record<string, number> = {};
  reflections.forEach((r) => {
    (r.passions || []).forEach((id) => {
      const label = AVAILABLE_PASSIONS.find((p) => p.id === id)?.label || id;
      counts[label] = (counts[label] || 0) + 1;
    });
  });
  return Object.entries(counts)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

export default function Council({ reflections, today, cycleStartDate: _cycleStartDate, loading, onClose, onGoToSettings }: CouncilProps) {
  const { commitments } = useCommitments();
  const mentorEnabled = useMentorEnabled();

  const info = useMemo(() => getCycleInfo(today), [today]);
  const curriculum = getWeekCurriculum(info.week);
  const disc = DISCIPLINE_SUMMARY[curriculum.discipline];

  // The current cycle-week's absolute day span (partial until the week closes).
  const week = useMemo(() => {
    const startDay = (info.cycle - 1) * 28 + (info.week - 1) * 7 + 1;
    const endDay = Math.min(startDay + 6, today);
    const inWeek = reflections.filter((r) => r.quoteId >= startDay && r.quoteId <= endDay);
    const daysLogged = new Set(inWeek.filter((r) => r.text || r.morningIntentions || r.mood).map((r) => r.quoteId)).size;
    const ledger = ledgerStats(commitmentsInDayRange(commitments, startDay, endDay));
    const broken = commitmentsInDayRange(commitments, startDay, endDay)
      .filter((c) => c.status === 'broken')
      .map((c) => c.text);
    const passions = passionCounts(inWeek).slice(0, 3);
    const moods: Record<string, number> = {};
    inWeek.forEach((r) => {
      if (r.mood) moods[r.mood] = (moods[r.mood] || 0) + 1;
    });
    const dominantMood = Object.entries(moods).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
    return { startDay, endDay, daysInSpan: endDay - startDay + 1, daysLogged, ledger, broken, passions, dominantMood };
  }, [info, today, reflections, commitments]);

  const councilPrompt = useMemo<MentorPrompt | null>(() => {
    const hasMaterial = week.daysLogged > 0 || week.ledger.total > 0;
    if (!hasMaterial) return null;
    return buildCouncilPrompt({
      cycle: info.cycle,
      week: info.week,
      virtue: curriculum.virtue,
      discipline: curriculum.discipline,
      disciplineGloss: disc.gloss,
      focusQuestion: curriculum.focusQuestion,
      daysLogged: week.daysLogged,
      daysInSpan: week.daysInSpan,
      keptRate: week.ledger.keptRate,
      reckonedCount: week.ledger.kept + week.ledger.broken,
      brokenPromises: week.broken,
      topPassions: week.passions,
      dominantMood: week.dominantMood,
    });
  }, [info, curriculum, disc, week]);

  const arcPrompt = useMemo<MentorPrompt | null>(() => {
    const allLedger = ledgerStats(commitments);
    const recurring = passionCounts(reflections).slice(0, 3);
    const daysPracticed = new Set(
      reflections.filter((r) => r.text || r.morningIntentions || r.mood || r.fateInput).map((r) => r.quoteId),
    ).size;
    const cyclesCompleted = info.cycle - 1;
    // The character arc needs a real span to be worth summoning.
    if (daysPracticed < 5 && allLedger.total === 0) return null;
    const virtues: Record<string, number> = {};
    reflections.forEach((r) => {
      if (r.virtue) virtues[r.virtue] = (virtues[r.virtue] || 0) + 1;
    });
    const strongestVirtue = Object.entries(virtues).sort((a, b) => b[1] - a[1])[0]?.[0] || undefined;
    return buildCharacterArcPrompt({
      span: cyclesCompleted > 0 ? `${cyclesCompleted} completed cycle${cyclesCompleted === 1 ? '' : 's'}` : 'their practice so far',
      cyclesCompleted,
      daysPracticed,
      keptRate: allLedger.keptRate,
      reckonedCount: allLedger.kept + allLedger.broken,
      recurringPassions: recurring,
      strongestVirtue,
    });
  }, [reflections, commitments, info]);

  return (
    <div className="mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16">
      <div className="mb-8 flex items-center justify-between border-b border-tertiary pb-6">
        <div>
          <h2 className="font-display text-2xl text-text-primary flex items-center gap-2">
            <Users size={24} className="text-accent" />
            The Council
          </h2>
          <p className="text-sm text-text-secondary mt-1">
            A weekly reckoning with your own evidence — Cycle {info.cycle}, Week {info.week}
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-2 text-text-secondary hover:bg-background-tertiary transition-colors"
          title="Close the Council"
        >
          ✕
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-tertiary p-12 text-center bg-background-secondary text-sm text-text-secondary">
          Loading your full history…
        </div>
      ) : (
        <div className="space-y-6">
          {/* This week's discipline */}
          <section className="rounded-xl border border-accent/25 bg-accent-soft p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-1.5">
              <Milestone size={15} className="text-accent" />
              <span className="text-[10px] uppercase font-mono tracking-widest font-semibold text-accent/80">
                {curriculum.virtue} · Discipline of {curriculum.discipline}
              </span>
            </div>
            <h3 className="font-display text-lg text-text-primary">{curriculum.title}</h3>
            <p className="text-sm text-text-secondary leading-relaxed mt-1">{curriculum.teaching}</p>
            <p className="text-xs text-text-secondary italic mt-3 border-l-2 border-accent/40 pl-3">
              {curriculum.focusQuestion}
            </p>
          </section>

          {/* The week's evidence */}
          <section className="rounded-xl border border-tertiary bg-background-secondary p-5 sm:p-6">
            <h3 className="font-display text-lg text-text-primary mb-4">The week’s evidence</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="rounded-lg border border-tertiary bg-background-tertiary p-3">
                <div className="text-2xl font-display font-bold text-text-primary">{week.daysLogged}/{week.daysInSpan}</div>
                <div className="text-[9px] uppercase font-mono text-text-secondary mt-0.5">Days journaled</div>
              </div>
              <div className="rounded-lg border border-tertiary bg-background-tertiary p-3">
                <div className="text-2xl font-display font-bold text-accent">
                  {week.ledger.kept + week.ledger.broken > 0 ? `${week.ledger.keptRate}%` : '—'}
                </div>
                <div className="text-[9px] uppercase font-mono text-text-secondary mt-0.5">Promises kept</div>
              </div>
              <div className="rounded-lg border border-tertiary bg-background-tertiary p-3">
                <div className="text-2xl font-display font-bold text-text-primary truncate">{week.dominantMood || '—'}</div>
                <div className="text-[9px] uppercase font-mono text-text-secondary mt-0.5">Prevailing mood</div>
              </div>
              <div className="rounded-lg border border-tertiary bg-background-tertiary p-3">
                <div className="text-sm font-semibold text-text-primary truncate pt-1.5" title={week.passions[0]?.label}>
                  {week.passions[0]?.label?.split(' ')[0] || '—'}
                </div>
                <div className="text-[9px] uppercase font-mono text-text-secondary mt-0.5">Loudest passion</div>
              </div>
            </div>

            {week.broken.length > 0 && (
              <div className="mt-4 rounded-lg border border-energy/30 bg-energy/5 p-3">
                <span className="text-[10px] uppercase font-mono tracking-wider text-energy font-semibold flex items-center gap-1.5 mb-1.5">
                  <X size={12} /> Promises broken this week
                </span>
                <ul className="text-sm text-text-secondary space-y-1">
                  {week.broken.map((t, i) => (
                    <li key={i} className="line-through decoration-tertiary">{t}</li>
                  ))}
                </ul>
              </div>
            )}
            {week.broken.length === 0 && week.ledger.kept > 0 && (
              <div className="mt-4 flex items-center gap-2 text-sm text-success">
                <Check size={15} /> Every promise you reckoned this week, you kept.
              </div>
            )}
          </section>

          {/* The mentor convenes the council */}
          <MentorPanel
            title="The Council’s Verdict"
            intro="Let the mentor convene this week’s evidence, name the one truth in it, and charge you for the week ahead."
            cta="Convene the Council"
            prompt={councilPrompt}
            disabledHint="Journal a few days or reckon a promise this week, then convene the Council."
            enabled={mentorEnabled}
            onGoToSettings={onGoToSettings}
            icon={Users}
          />

          {/* The long view — character arc */}
          <MentorPanel
            title="The Long View"
            intro="Step back from the week. Let the mentor read the arc of who you are becoming across your whole practice — and name the work still ahead."
            cta="Take the long view"
            prompt={arcPrompt}
            disabledHint="A few more days of practice, and the long view becomes worth taking."
            enabled={mentorEnabled}
            onGoToSettings={onGoToSettings}
            icon={Telescope}
          />
        </div>
      )}
    </div>
  );
}
