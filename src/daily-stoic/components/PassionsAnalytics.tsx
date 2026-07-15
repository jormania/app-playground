import { useState, useMemo } from 'react';
import { ReflectionRecord } from '../services/NotionService';
import { cn } from '../lib/cn';
import { 
  Flame, 
  Clock, 
  Calendar, 
  Info, 
  ShieldCheck, 
  Heart,
  Scale,
  BookOpen
} from 'lucide-react';
import { AVAILABLE_PASSIONS } from '../data/passions';
import InsightPeriodFilter from './InsightPeriodFilter';
import { getInsightPeriodRange, INSIGHT_PERIOD_OPTIONS } from '../utils/insightPeriod';
import { useInsightPeriod } from '../lib/useInsightPeriod';

interface PassionsAnalyticsProps {
  reflections: ReflectionRecord[];
  loading: boolean;
  today: number;
  cycleStartDate: string;
  onClose: () => void;
}

const VIRTUE_ADVICE: Record<string, { virtue: string; Icon: any; advice: string; quote: string; author: string }> = {
  impatience: {
    virtue: 'Temperance (Sophrosyne)',
    Icon: Scale,
    quote: 'Keep this thought handy when you start to lose your temper: getting angry is not a manly quality. Passionate anger is a sign of weakness, not strength.',
    author: 'Marcus Aurelius',
    advice: 'Practice the Pause of Reason. When irritation strikes, wait 10 seconds before reacting. Remind yourself that external triggers cannot control your assent.'
  },
  anxiety: {
    virtue: 'Courage (Andreia)',
    Icon: ShieldCheck,
    quote: 'We suffer more often in imagination than in reality.',
    author: 'Seneca',
    advice: 'Practice Premeditatio Malorum (premeditation of evils). Write down the worst-case scenario and realize that even if it occurs, you have the inner resources to endure it.'
  },
  reputation: {
    virtue: 'Wisdom (Sophia)',
    Icon: BookOpen,
    quote: 'I have often wondered how it is that every man loves himself more than all the rest of men, but yet sets less value on his own opinion of himself than on the opinion of others.',
    author: 'Marcus Aurelius',
    advice: 'Focus on the Citadel of Self-Worth. Remember that other people\'s opinions are Not Up to Me. Your character and intent are your only true good.'
  },
  discontent: {
    virtue: 'Wisdom (Sophia)',
    Icon: BookOpen,
    quote: 'A noble mind is free from complaints and distress. It accepts fate and loves whatever happens.',
    author: 'Seneca',
    advice: 'Focus on Amor Fati (love of fate). Reframe your complaints as necessary training conditions. Ask yourself: "How can I use this obstacle to practice virtue?"'
  },
  pride: {
    virtue: 'Justice (Dikaiosyne)',
    Icon: Heart,
    quote: 'If you want to improve, be content to be thought foolish and stupid.',
    author: 'Epictetus',
    advice: 'Practice Intellectual Humility. Remind yourself that you know very little, check your desire to impress others or feel superior, and treat others with kindness.'
  },
  craving: {
    virtue: 'Temperance (Sophrosyne)',
    Icon: Scale,
    quote: 'Do not seek for things to happen the way you want them to; rather, wish that what happens happens the way it happens: then you will be happy.',
    author: 'Epictetus',
    advice: 'Focus on Non-Attachment. Practice voluntary discomfort (eating simple foods, wearing plain clothes) to break dependencies on external outcomes.'
  }
};

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getTimeOfDayLabel(hour: number): string {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

export default function PassionsAnalytics({ reflections, loading, today, cycleStartDate, onClose }: PassionsAnalyticsProps) {
  const [insightPeriod, setInsightPeriod] = useInsightPeriod();
  const [demoMode, setDemoMode] = useState(false);

  const periodRange = useMemo(
    () => getInsightPeriodRange(insightPeriod, cycleStartDate, today),
    [insightPeriod, cycleStartDate, today]
  );

  // 1. Filter and Calculate Real Data
  const stats = useMemo(() => {
    // Filter records in the selected period by actual calendar date
    const filteredRecords = reflections.filter(r => {
      if (!periodRange) return true;
      if (!r.date) return true; // include if no date available
      return r.date >= periodRange.start && r.date <= periodRange.end;
    });

    const passionsCount: Record<string, number> = {};
    AVAILABLE_PASSIONS.forEach(p => {
      passionsCount[p.id] = 0;
    });

    const timePatternCounts: Record<string, number> = {};
    let totalEntriesWithPassions = 0;

    filteredRecords.forEach(r => {
      if (r.passions && r.passions.length > 0) {
        totalEntriesWithPassions++;
        r.passions.forEach(pid => {
          if (pid in passionsCount) {
            passionsCount[pid]++;
          }
        });

        // Determine created time day and hour
        let dateObj: Date | null = null;
        if (r.createdTime) {
          dateObj = new Date(r.createdTime);
        } else if (r.date) {
          dateObj = new Date(r.date + 'T12:00:00'); // local noon fallback
        }

        if (dateObj && !isNaN(dateObj.getTime())) {
          const dayName = DAYS_OF_WEEK[dateObj.getDay()];
          const hour = dateObj.getHours();
          const timeLabel = getTimeOfDayLabel(hour);
          const patternKey = `${dayName} ${timeLabel}`;
          timePatternCounts[patternKey] = (timePatternCounts[patternKey] || 0) + 1;
        }
      }
    });

    // Find dominant passion
    let dominantPassionId = '';
    let maxPassionCount = 0;
    Object.entries(passionsCount).forEach(([pid, count]) => {
      if (count > maxPassionCount) {
        maxPassionCount = count;
        dominantPassionId = pid;
      }
    });

    // Find dominant temporal pattern
    let dominantPattern = '';
    let maxPatternCount = 0;
    Object.entries(timePatternCounts).forEach(([pattern, count]) => {
      if (count > maxPatternCount) {
        maxPatternCount = count;
        dominantPattern = pattern;
      }
    });

    return {
      passionsCount,
      totalEntries: filteredRecords.length,
      totalEntriesWithPassions,
      dominantPassionId,
      dominantPattern,
    };
  }, [reflections, periodRange]);

  // 2. Mock / Demo Data (matching user specs)
  const demoStats = useMemo(() => {
    const passionsCount: Record<string, number> = {
      impatience: 5,      // 42%
      reputation: 3,      // 25% (or 27% in user prompt example)
      anxiety: 2,         // 17%
      discontent: 1,      // 8%
      pride: 1,           // 8%
      craving: 0          // 0%
    };
    return {
      passionsCount,
      totalEntries: 12,
      totalEntriesWithPassions: 12,
      dominantPassionId: 'impatience',
      dominantPattern: 'Monday morning',
    };
  }, []);

  const activeStats = demoMode ? demoStats : stats;
  const hasData = activeStats.totalEntriesWithPassions > 0;

  // Process data for charts
  const listData = useMemo(() => {
    const list = AVAILABLE_PASSIONS.map(p => {
      const count = activeStats.passionsCount[p.id] || 0;
      const percentage = activeStats.totalEntriesWithPassions > 0 
        ? Math.round((count / activeStats.totalEntriesWithPassions) * 100)
        : 0;
      return {
        ...p,
        count,
        percentage
      };
    });
    // Sort descending by percentage
    return list.sort((a, b) => b.percentage - a.percentage);
  }, [activeStats]);

  const dominantPassionObj = AVAILABLE_PASSIONS.find(p => p.id === activeStats.dominantPassionId);
  const dominantVirtueObj = activeStats.dominantPassionId ? VIRTUE_ADVICE[activeStats.dominantPassionId] : null;
  const DominantIcon = dominantVirtueObj?.Icon || Info;

  const formattedTemporalPattern = useMemo(() => {
    if (!activeStats.dominantPattern) return '';
    // Format "Monday morning" to "Monday mornings"
    return `${activeStats.dominantPattern}s`;
  }, [activeStats.dominantPattern]);

  const periodPhrase =
    insightPeriod === 'all'
      ? 'your history'
      : INSIGHT_PERIOD_OPTIONS.find((o) => o.value === insightPeriod)!.label.toLowerCase();

  return (
    <div className="mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between border-b border-tertiary pb-6">
        <div>
          <h2 className="font-display text-2xl text-text-primary flex items-center gap-2">
            <Flame size={24} className="text-accent" />
            Passions & Judgments
          </h2>
          <p className="text-sm text-text-secondary mt-1">Philosophical self-knowledge & judgment analytics</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-2 text-text-secondary hover:bg-background-tertiary transition-colors"
          title="Close Passions"
        >
          ✕
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center rounded-xl border-2 border-dashed border-tertiary p-12 text-center bg-background-secondary text-sm text-text-secondary">
          Loading your full history…
        </div>
      ) : (
        <>
      {/* Epictetus Intro Quote */}
      <blockquote className="rounded-lg bg-background-secondary p-5 border border-tertiary italic text-sm text-text-secondary mb-8 leading-relaxed">
        "First, do not be swept away by the intensity of the impression; say, ‘Wait for me a little, impression; let me see what you are, and what you are about. Let me test you.’"
        <cite className="block text-right not-italic text-xs font-semibold mt-2 text-text-primary">— Epictetus, Discourses 2.18</cite>
      </blockquote>

      {/* Controls & Demo Toggle */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-6">
        {/* Insight Period Selection */}
        <InsightPeriodFilter value={insightPeriod} onChange={setInsightPeriod} />

        {/* Demo Mode Toggle */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <label htmlFor="demo-toggle" className="text-xs text-text-secondary font-medium">Demo Mode</label>
          <button
            id="demo-toggle"
            onClick={() => setDemoMode(!demoMode)}
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
              demoMode ? "bg-accent" : "bg-background-tertiary border-tertiary"
            )}
            role="switch"
            aria-checked={demoMode}
          >
            <span
              className={cn(
                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-text-primary shadow ring-0 transition duration-200 ease-in-out",
                demoMode ? "translate-x-5 bg-background-primary" : "translate-x-0"
              )}
            />
          </button>
        </div>
      </div>

      {!hasData ? (
        /* Citadel Mode (Empty State) */
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-tertiary p-12 text-center bg-background-secondary">
          <div className="h-16 w-16 rounded-full bg-accent/5 flex items-center justify-center text-accent mb-4 border border-accent/20">
            <ShieldCheck size={32} />
          </div>
          <h3 className="font-display text-xl text-text-primary mb-2">The Citadel of Mind is Clear</h3>
          <p className="text-sm text-text-secondary max-w-sm mb-6 leading-relaxed">
            No recurring passions or judgments have been recorded in the past {periodPhrase}.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setDemoMode(true)}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background-primary hover:bg-accent-hover transition-colors"
            >
              See Demo Analytics
            </button>
            <button
              onClick={onClose}
              className="rounded-lg border border-tertiary bg-background-tertiary px-4 py-2 text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors"
            >
              Start Journaling
            </button>
          </div>
        </div>
      ) : (
        /* Full Dashboard */
        <div className="space-y-6">
          {/* Training Ground Advice Panel */}
          {dominantPassionObj && dominantVirtueObj && (
            <div className="rounded-xl border border-accent/30 bg-accent-soft p-5 sm:p-6 shadow-sm animate-in fade-in zoom-in-95 duration-300">
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-background-primary border border-tertiary p-3 text-accent shrink-0 mt-1">
                  <DominantIcon size={24} />
                </div>
                <div className="space-y-3">
                  <div>
                    <span className="text-[10px] uppercase font-mono tracking-widest font-semibold text-accent/80 block">Current Training Ground</span>
                    <h3 className="font-display text-xl text-text-primary mt-0.5">
                      Friction Point: {dominantPassionObj.label}
                    </h3>
                  </div>

                  <p className="text-sm text-text-secondary leading-relaxed">
                    Over the past {periodPhrase}, the primary judgment pattern holding back your tranquility is <strong className="text-text-primary">{dominantPassionObj.label.toLowerCase()}</strong>.
                  </p>

                  <div className="border-t border-accent/20 pt-3 mt-3">
                    <span className="text-xs font-semibold text-text-secondary">Philosophical Advice:</span>
                    <p className="text-sm text-text-primary font-medium mt-1">
                      Focus on cultivating <span className="text-accent underline decoration-2 underline-offset-2">{dominantVirtueObj.virtue}</span>.
                    </p>
                    <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                      {dominantVirtueObj.advice}
                    </p>
                  </div>

                  <div className="rounded border border-tertiary bg-background-primary/40 p-3 italic text-xs text-text-secondary mt-2">
                    “{dominantVirtueObj.quote}”
                    <cite className="block text-right not-italic text-[10px] font-semibold mt-1">— {dominantVirtueObj.author}</cite>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Temporal Patterns & Quick Stats Row */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            {/* Temporal Patterns */}
            <div className="rounded-xl border border-tertiary bg-background-secondary p-5 flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-widest font-semibold text-text-secondary block">Temporal Patterns</span>
                <h4 className="font-display text-lg text-text-primary mt-1 flex items-center gap-2">
                  <Clock size={18} className="text-text-secondary" />
                  Chronological Friction
                </h4>
              </div>
              
              <div className="my-4">
                {formattedTemporalPattern ? (
                  <p className="text-sm text-text-secondary">
                    Your entries involving passions are most active on <span className="text-text-primary font-semibold underline decoration-accent/40 decoration-2">{formattedTemporalPattern}</span>.
                  </p>
                ) : (
                  <p className="text-sm text-text-secondary">
                    Not enough timestamped entries to detect a chronological pattern.
                  </p>
                )}
              </div>

              <div className="text-[10px] text-text-secondary/60 flex items-center gap-1.5 border-t border-tertiary/60 pt-2">
                <Info size={12} />
                Calculated from reflections created timestamps.
              </div>
            </div>

            {/* Quick Summary Counts */}
            <div className="rounded-xl border border-tertiary bg-background-secondary p-5 flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-widest font-semibold text-text-secondary block">Summary Metrics</span>
                <h4 className="font-display text-lg text-text-primary mt-1 flex items-center gap-2">
                  <Calendar size={18} className="text-text-secondary" />
                  Judgment Volume
                </h4>
              </div>

              <div className="my-4 space-y-2 text-sm">
                <div className="flex justify-between items-center border-b border-tertiary pb-1.5">
                  <span className="text-text-secondary">Total Logs</span>
                  <span className="font-medium text-text-primary">{activeStats.totalEntries}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary">Logs with Passions</span>
                  <span className="font-medium text-text-primary">{activeStats.totalEntriesWithPassions} ({activeStats.totalEntries > 0 ? Math.round((activeStats.totalEntriesWithPassions / activeStats.totalEntries) * 100) : 0}%)</span>
                </div>
              </div>

              <div className="text-[10px] text-text-secondary/60 flex items-center gap-1.5 border-t border-tertiary/60 pt-2">
                <Info size={12} />
                Reflects Epictetus' focus on recurring judgments.
              </div>
            </div>
          </div>

          {/* Passions Distribution Bar Chart */}
          <div className="rounded-xl border border-tertiary bg-background-secondary p-5 sm:p-6">
            <h3 className="font-display text-lg text-text-primary mb-1">
              🔥 Passion Distribution
            </h3>
            <p className="text-xs text-text-secondary mb-6">
              Percentage of passion logs involving each judgment pattern ({activeStats.totalEntriesWithPassions} total passion records)
            </p>

            <div className="space-y-4">
              {listData.map((p) => {
                const isDominant = p.id === activeStats.dominantPassionId;
                return (
                  <div key={p.id} className="space-y-1.5">
                    <div className="flex justify-between items-end text-xs">
                      <div className="flex items-center gap-2">
                        <span className={cn("font-medium", isDominant ? "text-accent font-semibold" : "text-text-primary")}>
                          {p.label}
                        </span>
                        <span className="text-[9px] uppercase font-mono tracking-wider opacity-50 px-1 rounded bg-background-tertiary border border-tertiary">
                          {p.category}
                        </span>
                      </div>
                      <span className="font-mono text-text-secondary">
                        {p.percentage}% ({p.count})
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-3 overflow-hidden rounded-full bg-background-tertiary border border-tertiary">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-700 ease-out",
                            // Tailwind opacity modifiers (bg-accent/NN) silently
                            // render fully transparent in this app — every colour
                            // token is a plain var(--color-*) hex string, which
                            // Tailwind 3's opacity mechanism can't blend without
                            // the <alpha-value> RGB-channel pattern (a separate,
                            // app-wide issue beyond this fix's scope). Use a solid
                            // token instead: border-primary is deliberately the
                            // strongest/most visible border tone in every preset,
                            // so it reads clearly against background-tertiary
                            // without depending on opacity at all.
                            isDominant ? "bg-accent shadow-[0_0_8px_var(--color-accent-soft)]" : "bg-border-primary"
                          )}
                          style={{ width: `${p.percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
