import { useState, useMemo } from 'react';
import { ReflectionRecord } from '../services/NotionService';
import { cn } from '../lib/cn';
import { 
  Heart, 
  Info, 
  Calendar
} from 'lucide-react';

interface AmorFatiDashboardProps {
  recentReflections: ReflectionRecord[];
  onClose: () => void;
}

const TAG_INFO: Record<string, { label: string; desc: string; advice: string; quote: string; author: string }> = {
  Situation: {
    label: 'Situation / Events',
    desc: 'External crises, accidents, unexpected disruptions, or physical obstacles.',
    advice: 'Practice the Reserve Clause (Hypothesis). Accept that you planned to succeed, but fate intervened. Reframe the setback as the raw material for a new path.',
    quote: 'The impediment to action advances action. What stands in the way becomes the way.',
    author: 'Marcus Aurelius'
  },
  Outcome: {
    label: 'Outcome / Results',
    desc: 'Failures, rejections, losses, or results not matching your desires.',
    advice: 'Focus on the Internal Goal. Your duty was to play the hand as well as possible. The actual outcome is Not Up to You. Embrace the reality of the score.',
    quote: 'If you want to improve, be content to be thought foolish and stupid.',
    author: 'Epictetus'
  },
  People: {
    label: 'People / Frictions',
    desc: 'Difficult conversations, rude remarks, toxic colleagues, or conflicts.',
    advice: 'Practice Marcus Aurelius\'s Morning Precept. Remind yourself that people act out of ignorance of what is good. Do not be angry or hate them; they are partners in nature.',
    quote: 'When you wake up in the morning, tell yourself: The people I deal with today will be meddling, ungrateful, arrogant, dishonest, jealous, and surly...',
    author: 'Marcus Aurelius'
  },
  Time: {
    label: 'Time / Delays',
    desc: 'Delays, wasted time, rush hours, waiting lines, or schedule conflicts.',
    advice: 'Practice Active Patience. Reframe waiting time as voluntary meditation or space to practice mindfulness. Nothing is a waste of time unless you allow it to sour your temper.',
    quote: 'Life is very short and anxious for those who forget the past, neglect the present, and fear the future.',
    author: 'Seneca'
  },
  Limitation: {
    label: 'Limitation / Constraints',
    desc: 'Lack of resources, energy, illness, physical injury, or systemic constraints.',
    advice: 'Practice Resource Re-framing. Ask yourself: "What strengths can this constraint help me develop?" (e.g. sickness develops endurance, constraints develop creativity).',
    quote: 'Sickness is a hindrance to the body, but not to your ability to choose, unless that is your choice.',
    author: 'Epictetus'
  }
};

const ALL_TAGS = ['Situation', 'Outcome', 'People', 'Time', 'Limitation'];

export default function AmorFatiDashboard({ recentReflections, onClose }: AmorFatiDashboardProps) {
  const [insightPeriod, setInsightPeriod] = useState<'30' | '90' | '365' | 'all'>('30');
  const [demoMode, setDemoMode] = useState(false);

  // 1. Calculate Real Statistics
  const stats = useMemo(() => {
    const periodDays = insightPeriod === 'all' ? Infinity : parseInt(insightPeriod, 10);
    const now = new Date();

    const filtered = recentReflections.filter(r => {
      if (insightPeriod === 'all') return true;
      if (!r.date) return true;
      const recordDate = new Date(r.date + 'T00:00:00');
      const diffDays = (now.getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays <= periodDays;
    });

    const reframedLogs = filtered.filter(r => r.fateInput && r.fateInput.trim().length > 0);

    const tagCounts: Record<string, number> = {};
    ALL_TAGS.forEach(tag => {
      tagCounts[tag] = 0;
    });

    filtered.forEach(r => {
      if (r.acceptanceTags) {
        r.acceptanceTags.forEach(tag => {
          if (tag in tagCounts) {
            tagCounts[tag]++;
          }
        });
      }
    });

    // Find dominant tag
    let dominantTag = '';
    let maxTagCount = 0;
    Object.entries(tagCounts).forEach(([tag, count]) => {
      if (count > maxTagCount) {
        maxTagCount = count;
        dominantTag = tag;
      }
    });

    // Extract historical obstacles (at least 7 days ago, sorted by date)
    const pastObstacles = recentReflections
      .filter(r => r.fateInput && r.fateInput.trim().length > 0)
      .filter(r => {
        if (!r.date) return false;
        const recordDate = new Date(r.date + 'T00:00:00');
        const diffDays = (now.getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays >= 7; // Only show things older than 7 days
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) // Newest first
      .slice(0, 5);

    return {
      totalLogs: filtered.length,
      reframedLogs: reframedLogs.length,
      reframeRate: filtered.length > 0 ? Math.round((reframedLogs.length / filtered.length) * 100) : 0,
      tagCounts,
      dominantTag,
      pastObstacles
    };
  }, [recentReflections, insightPeriod]);

  // 2. Demo Mock Data
  const demoStats = useMemo(() => {
    const tagCounts: Record<string, number> = {
      Situation: 5,
      Outcome: 3,
      People: 4,
      Time: 2,
      Limitation: 1
    };

    // Prepopulated retro obstacles for demonstration
    const pastObstacles = [
      {
        quoteId: 132,
        date: '2026-06-12', // exactly 30 days ago
        text: 'Thoughts...',
        fateInput: 'Major flight delay caused me to miss the opening presentation at the conferences.',
        acceptanceTags: ['Situation', 'Time']
      },
      {
        quoteId: 72,
        date: '2026-04-12', // exactly 90 days ago
        text: 'Thoughts...',
        fateInput: 'Our project proposal was rejected by the executive committee after weeks of work.',
        acceptanceTags: ['Outcome']
      }
    ];

    return {
      totalLogs: 22,
      reframedLogs: 15,
      reframeRate: 68,
      tagCounts,
      dominantTag: 'Situation',
      pastObstacles
    };
  }, []);

  const activeStats = demoMode ? demoStats : stats;
  const hasData = activeStats.reframedLogs > 0;

  // Process chart data
  const chartData = useMemo(() => {
    const list = ALL_TAGS.map(tag => {
      const count = activeStats.tagCounts[tag] || 0;
      const percentage = activeStats.reframedLogs > 0
        ? Math.round((count / activeStats.reframedLogs) * 100)
        : 0;
      return { tag, count, percentage };
    });
    return list.sort((a, b) => b.percentage - a.percentage);
  }, [activeStats]);

  // Dominant Tag advice mapping
  const dominantTagInfo = activeStats.dominantTag ? TAG_INFO[activeStats.dominantTag] : null;

  // Legacy rating/notes removed for simplicity

  return (
    <div className="mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between border-b border-tertiary pb-6">
        <div>
          <h2 className="font-display text-2xl text-text-primary flex items-center gap-2">
            <Heart size={24} className="text-caution fill-caution/20 animate-pulse" />
            Amor Fati
          </h2>
          <p className="text-sm text-text-secondary mt-1">Accepting and embracing external obstacles as raw materials</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-2 text-text-secondary hover:bg-background-tertiary transition-colors"
          title="Close Amor Fati"
        >
          ✕
        </button>
      </div>

      {/* Intro Quote */}
      <blockquote className="rounded-lg bg-background-secondary p-5 border border-tertiary italic text-sm text-text-secondary mb-8 leading-relaxed">
        "My formula for greatness in a human being is amor fati: that one wants nothing to be different, not forward, not backward, not in all eternity. Not merely bear what is necessary, still less conceal it... but love it."
        <cite className="block text-right not-italic text-xs font-semibold mt-2 text-text-primary">— Friedrich Nietzsche, Ecce Homo</cite>
      </blockquote>

      {/* Controls & Demo Toggle */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-6">
        {/* Insight Period Selection */}
        <div className="flex items-center gap-1 rounded-md bg-background-tertiary p-1 border border-tertiary w-full sm:w-auto overflow-x-auto">
          {(['30', '90', '365', 'all'] as const).map((period) => (
            <button
              key={period}
              onClick={() => setInsightPeriod(period)}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-sm transition-all text-center flex-1 sm:flex-none min-w-[3.5rem]",
                insightPeriod === period
                  ? 'bg-background-secondary text-text-primary shadow-sm border border-tertiary'
                  : 'text-text-secondary hover:text-text-primary'
              )}
            >
              {period === 'all' ? 'All' : `${period}d`}
            </button>
          ))}
        </div>

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
        /* Empty State */
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-tertiary p-12 text-center bg-background-secondary">
          <div className="h-16 w-16 rounded-full bg-accent/5 flex items-center justify-center text-accent mb-4 border border-accent/20">
            <Heart size={32} className="text-caution" />
          </div>
          <h3 className="font-display text-xl text-text-primary mb-2">No Obstacles Reframed</h3>
          <p className="text-sm text-text-secondary max-w-sm mb-6 leading-relaxed">
            Record what feels forced or heavy and reframe it under **Amor Fati** during your Daily Reflections to populate this dashboard.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setDemoMode(true)}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background-primary hover:bg-accent-hover transition-colors"
            >
              See Demo Analytics
            </button>
          </div>
        </div>
      ) : (
        /* Full Dashboard */
        <div className="space-y-6">
          {/* Summary Metric Row */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            {/* Reframe Rate */}
            <div className="rounded-xl border border-tertiary bg-background-secondary p-5 flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-widest font-semibold text-text-secondary block">Adoption Quotient</span>
                <h4 className="font-display text-lg text-text-primary mt-1 flex items-center gap-2">
                  💫 Amor Fati Rate
                </h4>
              </div>

              <div className="my-4 flex items-center gap-4">
                <div className="text-4xl font-display font-bold text-accent">
                  {activeStats.reframeRate}%
                </div>
                <div className="text-xs text-text-secondary leading-relaxed">
                  You actively reframed challenges in <strong className="text-text-primary">{activeStats.reframedLogs}</strong> out of your <strong className="text-text-primary">{activeStats.totalLogs}</strong> daily reflection logs.
                </div>
              </div>

              <div className="text-[10px] text-text-secondary/60 flex items-center gap-1.5 border-t border-tertiary/60 pt-2">
                <Info size={12} />
                Measures how consistently you practice reframing setbacks.
              </div>
            </div>

            {/* Dominant Obstacle Card */}
            <div className="rounded-xl border border-tertiary bg-background-secondary p-5 flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-widest font-semibold text-text-secondary block">Dominant tag</span>
                <h4 className="font-display text-lg text-text-primary mt-1 flex items-center gap-2">
                  🏔️ Main Friction Type
                </h4>
              </div>

              <div className="my-4">
                {dominantTagInfo ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text-primary underline decoration-accent/40 decoration-2">
                      {dominantTagInfo.label}
                    </span>
                    <span className="text-[10px] text-text-secondary leading-tight opacity-80 block max-w-[140px] truncate">
                      {dominantTagInfo.desc}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary">No tags recorded.</p>
                )}
              </div>

              <div className="text-[10px] text-text-secondary/60 flex items-center gap-1.5 border-t border-tertiary/60 pt-2">
                <Info size={12} />
                Highlights the typical category of your challenges.
              </div>
            </div>
          </div>

          {/* Stoic tag Advice Callout */}
          {dominantTagInfo && (
            <div className="rounded-xl border border-accent/30 bg-accent-soft p-5 sm:p-6 shadow-sm">
              <span className="text-[10px] uppercase font-mono tracking-widest font-semibold text-accent/80 block">Challenge type focus</span>
              <h3 className="font-display text-xl text-text-primary mt-0.5 mb-2">
                Reframing: {dominantTagInfo.label}
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                {dominantTagInfo.advice}
              </p>
              
              <div className="rounded border border-tertiary bg-background-primary/40 p-3 italic text-xs text-text-secondary mt-3">
                “{dominantTagInfo.quote}”
                <cite className="block text-right not-italic text-[10px] font-semibold mt-1">— {dominantTagInfo.author}</cite>
              </div>
            </div>
          )}

          {/* Retrospective Timeline ("Trivialized Obstacles") */}
          <div className="rounded-xl border border-tertiary bg-background-secondary p-5 sm:p-6">
            <h3 className="font-display text-lg text-text-primary mb-1">
              ⌛ Trivialized Obstacles
            </h3>
            <p className="text-xs text-text-secondary mb-6 leading-relaxed">
              "30 days ago, you thought this was a major obstacle." Looking back at past "catastrophes" is one of the best teachers of Amor Fati. Review how your perspective has shifted:
            </p>

            <div className="space-y-6">
              {activeStats.pastObstacles.map((w, idx) => {
                return (
                  <div key={idx} className="border-b border-tertiary/60 pb-5 last:border-b-0 last:pb-0 space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-xs font-mono font-semibold text-accent uppercase flex items-center gap-1.5">
                        <Calendar size={12} />
                        {w.date || `Day ${w.quoteId}`}
                      </span>
                      <div className="flex gap-1">
                        {w.acceptanceTags?.map(t => (
                          <span key={t} className="text-[9px] uppercase font-mono tracking-wide px-1.5 py-0.5 rounded bg-background-tertiary border border-tertiary opacity-70">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>

                    <p className="text-sm text-text-primary bg-background-tertiary p-3 border border-tertiary rounded-lg leading-relaxed italic">
                      "{w.fateInput}"
                    </p>

                    {/* Retrospective Insight Note */}
                    <div className="space-y-2.5">
                      <div className="rounded border border-tertiary/30 bg-background-primary/20 p-3 text-xs text-text-secondary/70 italic leading-relaxed">
                        Insight: Notice how this situation has likely faded in importance over time. Observe how it taught you patience, acceptance, or wisdom. (No action required).
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* tag Distribution */}
          <div className="rounded-xl border border-tertiary bg-background-secondary p-5 sm:p-6">
            <h3 className="font-display text-lg text-text-primary mb-1">
              📊 Friction tag Distribution
            </h3>
            <p className="text-xs text-text-secondary mb-6">
              Percentage of reframed reflections that were tagged with each challenge type
            </p>

            <div className="space-y-4">
              {chartData.map((tagObj) => {
                const isDominant = tagObj.tag === activeStats.dominantTag;
                return (
                  <div key={tagObj.tag} className="space-y-1.5">
                    <div className="flex justify-between items-end text-xs">
                      <span className={cn("font-medium", isDominant ? "text-accent font-semibold" : "text-text-primary")}>
                        {TAG_INFO[tagObj.tag]?.label || tagObj.tag}
                      </span>
                      <span className="font-mono text-text-secondary">
                        {tagObj.percentage}% ({tagObj.count})
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-3 overflow-hidden rounded-full bg-background-tertiary border border-tertiary">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-700 ease-out",
                            isDominant ? "bg-accent shadow-[0_0_8px_var(--color-accent-soft)]" : "bg-text-secondary/40"
                          )}
                          style={{ width: `${tagObj.percentage}%` }}
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
    </div>
  );
}
