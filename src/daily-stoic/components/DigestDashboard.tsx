import { useMemo, useState } from 'react';
import { Modal } from '../../ds';
import { ReflectionRecord } from '../services/NotionService';
import { Worry } from '../utils/retrospective';
import { buildDigestEntries, DayDigestEntry, CycleDigestEntry } from '../utils/digest';
import { getQuoteForDay } from '../utils/date';
import CycleRetrospectiveCard from './CycleRetrospectiveCard';
import { cn } from '../lib/cn';
import {
  History,
  Lightbulb,
  Swords,
  Gavel,
  Anchor,
  Shield,
  Star,
  Calendar,
  HelpCircle,
  Scale,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';

const VIRTUE_ICONS: Record<string, LucideIcon> = {
  Wisdom: Lightbulb,
  Courage: Swords,
  Justice: Gavel,
  Temperance: Anchor,
};

// Same labels AmorFatiDashboard uses for these tags — they categorize what
// kind of obstacle the day's Amor Fati reframe (fateInput) was about, so
// showing the label instead of the bare tag makes that legible on its own.
const TAG_LABELS: Record<string, string> = {
  Situation: 'Situation / Events',
  Outcome: 'Outcome / Results',
  People: 'People / Frictions',
  Time: 'Time / Delays',
  Limitation: 'Limitation / Constraints',
};

// Same wording DichotomyOfControl.tsx uses for these categories.
const WORRY_CATEGORY_LABELS: Record<Worry['category'], string> = {
  'up-to-me': 'Up to Me',
  'not-up-to-me': 'Not Up to Me',
  unassigned: 'Unassigned',
};
const WORRY_CATEGORY_COLORS: Record<Worry['category'], string> = {
  'up-to-me': 'text-success',
  'not-up-to-me': 'text-energy',
  unassigned: 'text-text-secondary',
};

// The saved reflection text is built as "### Question\nAnswer" blocks joined
// by blank lines (see Journal.tsx's Seneca-question combiner) — split it back
// into question/answer pairs for display instead of showing the raw "###"
// markers as one run-on paragraph. Falls back to the raw text as a single
// block for older entries that don't follow this shape.
function parseReflectionQA(text?: string): { question: string; answer: string }[] {
  if (!text) return [];
  const blocks = text
    .split(/\n{0,2}###\s+/)
    .map((b) => b.trim())
    .filter(Boolean);
  if (blocks.length === 0) return [];
  return blocks.map((block) => {
    const breakIdx = block.indexOf('\n');
    return breakIdx === -1
      ? { question: block, answer: '' }
      : { question: block.slice(0, breakIdx).trim(), answer: block.slice(breakIdx + 1).trim() };
  });
}

interface DigestDashboardProps {
  today: number;
  cycleStartDate: string;
  reflections: ReflectionRecord[];
  worries: Worry[];
  loading: boolean;
  onClose: () => void;
}

export default function DigestDashboard({
  today,
  cycleStartDate,
  reflections,
  worries,
  loading,
  onClose,
}: DigestDashboardProps) {
  const [selectedDay, setSelectedDay] = useState<DayDigestEntry | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<CycleDigestEntry | null>(null);

  const entries = useMemo(
    () => buildDigestEntries(today, cycleStartDate, reflections, worries),
    [today, cycleStartDate, reflections, worries]
  );

  return (
    <div className="mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16">
      <div className="mb-6 sm:mb-8 flex items-center justify-between border-b border-tertiary pb-4 sm:pb-6">
        <div>
          <h2 className="font-display text-xl sm:text-2xl text-text-primary flex items-center gap-2">
            <History size={22} className="text-accent" />
            Digest
          </h2>
          <p className="text-sm text-text-secondary mt-1">Your archive of days, weeks, and cycles</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-2 text-text-secondary hover:bg-background-tertiary transition-colors"
          title="Close Digest"
        >
          ✕
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-tertiary p-12 text-center bg-background-secondary text-sm text-text-secondary">
          Loading your full history…
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            if (entry.type === 'day') {
              const VirtueIcon = VIRTUE_ICONS[entry.virtue] ?? Shield;
              const hasEntry = !!entry.reflection;
              return (
                <button
                  key={`day-${entry.day}`}
                  onClick={() => setSelectedDay(entry)}
                  className="w-full flex items-center gap-3 rounded-lg border border-tertiary bg-background-secondary px-4 py-3 text-left hover:bg-background-tertiary transition-colors"
                >
                  <VirtueIcon size={16} className="text-accent shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-text-primary truncate">
                      {entry.label} ({entry.virtue})
                    </div>
                    <div className="text-[11px] text-text-secondary">{entry.date}</div>
                  </div>
                  {entry.reflection?.favorite && (
                    <Star size={14} className="text-caution fill-caution shrink-0" />
                  )}
                  {!hasEntry && (
                    <span className="text-[10px] uppercase font-mono tracking-wide text-text-secondary shrink-0">
                      No entry
                    </span>
                  )}
                </button>
              );
            }

            if (entry.type === 'week') {
              const VirtueIcon = VIRTUE_ICONS[entry.virtue] ?? Shield;
              return (
                <div
                  key={`week-${entry.cycle}-${entry.week}`}
                  className="rounded-lg border border-accent bg-accent-soft px-4 py-3.5"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <VirtueIcon size={16} className="text-accent shrink-0" />
                    <span className="text-sm font-semibold text-text-primary">
                      Week {entry.week} Complete — {entry.virtue}
                    </span>
                  </div>
                  <div className="text-[11px] text-text-secondary mb-2">
                    {entry.dateRange.start} – {entry.dateRange.end} · {entry.loggedCount} of 7 days logged
                  </div>
                  {entry.quoteOfWeek && (
                    <blockquote className="text-xs text-text-secondary italic leading-relaxed border-t border-tertiary pt-2">
                      "{entry.quoteOfWeek.quote}"
                      <cite className="block not-italic text-[10px] font-semibold text-text-primary mt-1">
                        — {entry.quoteOfWeek.author}
                      </cite>
                    </blockquote>
                  )}
                </div>
              );
            }

            // Cycle digest
            return (
              <div
                key={`cycle-${entry.cycle}`}
                className="rounded-lg border border-accent bg-background-secondary px-4 py-4 shadow-sm"
              >
                <div className="text-sm font-display font-semibold text-text-primary mb-1">
                  🌟 Cycle {entry.cycle} Complete
                </div>
                <div className="text-[11px] text-text-secondary mb-3">
                  {entry.retrospective.dateRange.start} – {entry.retrospective.dateRange.end} ·{' '}
                  {entry.retrospective.consistencyRate}% consistency
                </div>
                <button
                  onClick={() => setSelectedCycle(entry)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                >
                  View full retrospective
                  <ArrowRight size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {selectedDay && (
        <Modal
          open={!!selectedDay}
          onClose={() => setSelectedDay(null)}
          title={`${selectedDay.label} (${selectedDay.virtue})`}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-1.5 text-xs text-text-secondary">
              <Calendar size={12} />
              {selectedDay.date}
            </div>

            {(() => {
              const dayQuote = getQuoteForDay(selectedDay.day);
              const isFavorited = !!selectedDay.reflection?.favorite;
              const qaBlocks = parseReflectionQA(selectedDay.reflection?.text);
              const dayWorries = worries.filter((w) => w.createdAt === selectedDay.date);
              const r = selectedDay.reflection;
              const hasReflectionContent = !!r && !!(
                r.text || r.morningIntentions || r.fateInput || r.mood || r.virtue || (r.passions && r.passions.length > 0)
              );

              return (
                <>
                  {/* Always shown: this is what "Favorited" refers to when starred. */}
                  <div className="rounded-lg border border-tertiary bg-background-tertiary p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-text-secondary">
                        Today's Quote
                      </span>
                      {isFavorited && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-caution">
                          <Star size={12} className="fill-caution" /> Favorited
                        </span>
                      )}
                    </div>
                    <blockquote className="text-sm text-text-primary italic leading-relaxed">
                      "{dayQuote.quote}"
                      <cite className="block not-italic text-xs font-semibold text-text-secondary mt-1.5">
                        — {dayQuote.author}
                      </cite>
                    </blockquote>
                  </div>

                  {r?.morningIntentions && (
                    <div>
                      <span className="text-[10px] uppercase font-mono tracking-wider text-text-secondary flex items-center gap-1.5 mb-1">
                        <Shield size={12} /> Premeditatio Malorum
                      </span>
                      <div className="bg-background-tertiary p-3 border border-tertiary rounded-lg">
                        <p className="text-xs font-semibold text-caution leading-snug">
                          What obstacles might I anticipate today, and how will I meet them with virtue?
                        </p>
                        <p className="text-sm text-text-primary leading-relaxed mt-1">{r.morningIntentions}</p>
                      </div>
                    </div>
                  )}

                  {qaBlocks.length > 0 ? (
                    <div>
                      <span className="text-[10px] uppercase font-mono tracking-wider text-text-secondary flex items-center gap-1.5 mb-1">
                        <HelpCircle size={12} /> Evening Interrogation
                      </span>
                      <div className="space-y-3 bg-background-tertiary p-3 border border-tertiary rounded-lg">
                        {qaBlocks.map((qa, idx) => (
                          <div key={idx} className={idx > 0 ? 'pt-3 border-t border-tertiary' : ''}>
                            <p className="text-xs font-semibold text-accent leading-snug">{qa.question}</p>
                            {qa.answer && (
                              <p className="text-sm text-text-primary leading-relaxed mt-1">{qa.answer}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    r?.text && (
                      <div>
                        <span className="text-[10px] uppercase font-mono tracking-wider text-text-secondary flex items-center gap-1.5 mb-1">
                          <HelpCircle size={12} /> Evening Interrogation
                        </span>
                        <p className="text-sm text-text-primary bg-background-tertiary p-3 border border-tertiary rounded-lg leading-relaxed">
                          {r.text}
                        </p>
                      </div>
                    )
                  )}

                  {r?.mood && (
                    <div>
                      <span className="text-[10px] uppercase font-mono tracking-wider text-text-secondary block mb-1">
                        Mood
                      </span>
                      <p className="text-sm text-text-primary bg-background-tertiary p-3 border border-tertiary rounded-lg">
                        {r.mood}
                      </p>
                    </div>
                  )}

                  {dayWorries.length > 0 && (
                    <div>
                      <span className="text-[10px] uppercase font-mono tracking-wider text-text-secondary flex items-center gap-1.5 mb-1">
                        <Scale size={12} /> Spheres of Choice
                      </span>
                      <div className="space-y-2 bg-background-tertiary p-3 border border-tertiary rounded-lg">
                        {dayWorries.map((w) => (
                          <div key={w.id} className="flex items-start justify-between gap-3">
                            <span
                              className={cn(
                                'text-sm text-text-primary',
                                w.isResolved && 'line-through text-text-secondary'
                              )}
                            >
                              {w.text}
                            </span>
                            <span
                              className={cn(
                                'text-[10px] font-semibold uppercase shrink-0',
                                WORRY_CATEGORY_COLORS[w.category]
                              )}
                            >
                              {WORRY_CATEGORY_LABELS[w.category]}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {r?.fateInput && (
                    <div>
                      <span className="text-[10px] uppercase font-mono tracking-wider text-text-secondary block mb-1">
                        Amor Fati Reframe
                      </span>
                      <p className="text-sm text-text-primary bg-background-tertiary p-3 border border-tertiary rounded-lg leading-relaxed italic">
                        "{r.fateInput}"
                      </p>
                      {r.acceptanceTags && r.acceptanceTags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {r.acceptanceTags.map((t) => (
                            <span
                              key={t}
                              className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-background-secondary border border-tertiary text-text-secondary"
                              title="What kind of obstacle this reframe was about"
                            >
                              {TAG_LABELS[t] || t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {r?.passions && r.passions.length > 0 && (
                    <div>
                      <span className="text-[10px] uppercase font-mono tracking-wider text-text-secondary block mb-1">
                        Passions Tamed
                      </span>
                      <p className="text-sm text-text-primary bg-background-tertiary p-3 border border-tertiary rounded-lg">
                        {r.passions.join(', ')}
                      </p>
                    </div>
                  )}

                  {r?.virtue && (
                    <div>
                      <span className="text-[10px] uppercase font-mono tracking-wider text-text-secondary block mb-1">
                        Virtue Practiced
                      </span>
                      <p className="text-sm text-text-primary bg-background-tertiary p-3 border border-tertiary rounded-lg">
                        {r.virtue}
                      </p>
                    </div>
                  )}

                  {!hasReflectionContent && dayWorries.length === 0 && (
                    <p className="text-sm text-text-secondary italic">No reflection recorded for this day.</p>
                  )}
                </>
              );
            })()}
          </div>
        </Modal>
      )}

      {selectedCycle && (
        <Modal
          open={!!selectedCycle}
          onClose={() => setSelectedCycle(null)}
          title={`Cycle ${selectedCycle.cycle} Retrospective`}
        >
          <div className="space-y-4">
            <p className="text-xs text-text-secondary">
              {selectedCycle.retrospective.dateRange.start} – {selectedCycle.retrospective.dateRange.end}
            </p>
            <CycleRetrospectiveCard retrospective={selectedCycle.retrospective} />
          </div>
        </Modal>
      )}
    </div>
  );
}
