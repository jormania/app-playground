import { useState, useMemo, useEffect } from 'react';
import { cn } from '../lib/cn';
import { Scale, CheckCircle2, CloudFog, AlertCircle, Info, Sparkles } from 'lucide-react';

interface Worry {
  id: string;
  text: string;
  category: 'unassigned' | 'up-to-me' | 'not-up-to-me';
  isResolved?: boolean;
  createdAt?: string;
}

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'as', 'at', 
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can', 'cannot', 
  'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 
  'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'himself', 'his', 'how', 'i', 'if', 'in', 
  'into', 'is', 'it', 'its', 'itself', 'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'of', 
  'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 
  'she', 'should', 'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 
  'then', 'there', 'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 
  'very', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 
  'would', 'you', 'your', 'yours', 'yourself', 'yourselves'
]);

function extractKeywords(texts: string[]): { text: string; value: number }[] {
  const counts: Record<string, number> = {};
  
  texts.forEach(text => {
    const words = text
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?\n]/g, '')
      .split(/\s+/);
      
    words.forEach(word => {
      const trimmed = word.trim();
      if (trimmed.length > 2 && !STOP_WORDS.has(trimmed)) {
        counts[trimmed] = (counts[trimmed] || 0) + 1;
      }
    });
  });

  return Object.entries(counts)
    .map(([text, value]) => ({ text, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 15); // Top 15 keywords
}

interface DichotomyOfControlProps {
  onClose?: () => void;
  worries?: Worry[];
}

export function DichotomyOfControl({ onClose, worries: propWorries }: DichotomyOfControlProps = {}) {
  const [insightPeriod, setInsightPeriod] = useState<'30' | '90' | '365' | 'all'>('30');
  const [demoMode, setDemoMode] = useState(false);
  const [localWorries, setLocalWorries] = useState<Worry[]>([]);

  // Load from localStorage only when no prop worries are provided (offline mode)
  useEffect(() => {
    if (!propWorries) {
      const saved = localStorage.getItem('daily-stoic:dichotomy');
      if (saved) {
        try {
          setLocalWorries(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to parse dichotomy worries:', e);
        }
      }
    }
  }, [propWorries]);

  // Use Notion-sourced prop worries when available, localStorage otherwise
  const worries = propWorries ?? localWorries;

  // Calculate Real Data
  const stats = useMemo(() => {
    const today = new Date();
    const periodDays = insightPeriod === 'all' ? 366 : parseInt(insightPeriod, 10);

    const filtered = worries.filter(w => {
      if (insightPeriod === 'all') return true;
      if (!w.createdAt) return true; // Include unsaved timestamps as general entries
      const date = new Date(w.createdAt);
      const diffMs = today.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      return diffDays <= periodDays;
    });

    const upToMe = filtered.filter(w => w.category === 'up-to-me');
    const notUpToMe = filtered.filter(w => w.category === 'not-up-to-me');

    const total = upToMe.length + notUpToMe.length;
    const upToMePercentage = total > 0 ? Math.round((upToMe.length / total) * 100) : 0;
    const notUpToMePercentage = total > 0 ? Math.round((notUpToMe.length / total) * 100) : 0;

    const resolvedUpToMe = upToMe.filter(w => w.isResolved).length;
    const resolutionRate = upToMe.length > 0 ? Math.round((resolvedUpToMe / upToMe.length) * 100) : 0;

    // Keywords
    const upToMeKeywords = extractKeywords(upToMe.map(w => w.text));
    const notUpToMeKeywords = extractKeywords(notUpToMe.map(w => w.text));

    return {
      upToMe,
      notUpToMe,
      total,
      upToMePercentage,
      notUpToMePercentage,
      resolutionRate,
      resolvedUpToMe,
      upToMeKeywords,
      notUpToMeKeywords
    };
  }, [worries, insightPeriod]);

  // Demo Mock Data
  const demoStats = useMemo(() => {
    const upToMeKeywords = [
      { text: 'reaction', value: 8 },
      { text: 'schedule', value: 6 },
      { text: 'effort', value: 5 },
      { text: 'focus', value: 4 },
      { text: 'exercise', value: 3 },
      { text: 'temper', value: 3 },
      { text: 'preparation', value: 2 },
      { text: 'diet', value: 2 },
      { text: 'response', value: 2 }
    ];

    const notUpToMeKeywords = [
      { text: 'traffic', value: 9 },
      { text: 'weather', value: 7 },
      { text: 'boss', value: 6 },
      { text: 'opinions', value: 5 },
      { text: 'delays', value: 4 },
      { text: 'market', value: 3 },
      { text: 'comments', value: 3 },
      { text: 'outcome', value: 2 },
      { text: 'criticism', value: 2 }
    ];

    return {
      upToMe: new Array(6),
      notUpToMe: new Array(4),
      total: 10,
      upToMePercentage: 60,
      notUpToMePercentage: 40,
      resolutionRate: 75,
      resolvedUpToMe: 4,
      upToMeKeywords,
      notUpToMeKeywords
    };
  }, []);

  const activeStats = demoMode ? demoStats : stats;
  const hasData = activeStats.total > 0;

  // Philosophical Advice
  const advice = useMemo(() => {
    if (!hasData) return null;
    if (activeStats.notUpToMePercentage > activeStats.upToMePercentage) {
      return {
        title: "Focus Shift Recommended: External Overload",
        style: "border-energy/30 bg-energy/5 text-text-primary",
        text: "You are documenting more concerns that are outside your control than within it. Epictetus warned that focusing on externals breeds anxiety and fault-finding. Remind yourself daily: 'This is not up to me,' and pivot your mental energy back to your own judgments and reactions.",
        exercise: "The Pivot Practice: For every external concern you record, write down one specific, small action you can control that relates to it."
      };
    } else {
      return {
        title: "Strong Agency Focus",
        style: "border-success/30 bg-success/5 text-text-primary",
        text: "Your mind is correctly aligned towards things Up to You. Stoics call this practicing the Discipline of Assent. You are focusing on your own efforts, schedule, and reactions. Maintain this awareness and make sure you actively resolve your logged concerns.",
        exercise: "Action Audit: Look at your unresolved 'Up to Me' concerns and schedule 10 minutes today to act on the most straightforward one."
      };
    }
  }, [activeStats, hasData]);

  // Render a Word Cloud
  const renderWordCloud = (keywords: { text: string; value: number }[], colorClass: string) => {
    if (keywords.length === 0) {
      return (
        <div className="flex h-32 items-center justify-center text-xs text-text-secondary italic">
          Not enough logged worries to extract keywords.
        </div>
      );
    }

    const maxVal = Math.max(...keywords.map(k => k.value));
    
    return (
      <div className="flex flex-wrap gap-2.5 justify-center items-center p-4 bg-background-tertiary rounded-lg border border-tertiary min-h-[140px]">
        {keywords.map((word, idx) => {
          // Calculate font size relative to frequency
          const ratio = maxVal > 0 ? word.value / maxVal : 0.5;
          const fontSize = 11 + ratio * 12; // 11px to 23px
          const opacity = 0.5 + ratio * 0.5; // 0.5 to 1.0
          
          return (
            <span
              key={idx}
              style={{ fontSize: `${fontSize}px`, opacity }}
              className={cn("font-medium tracking-tight px-1.5 transition-all duration-300", colorClass)}
              title={`Frequency: ${word.value}`}
            >
              {word.text}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500 pb-16">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between border-b border-tertiary pb-6">
        <div>
          <h2 className="font-display text-2xl text-text-primary flex items-center gap-2">
            <Scale size={24} className="text-text-secondary" />
            Spheres of Choice
          </h2>
          <p className="text-sm text-text-secondary mt-1">Dichotomy of control analytics & mindfulness mapping</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-full p-2 text-text-secondary hover:bg-background-tertiary transition-colors"
            title="Close Dashboard"
          >
            ✕
          </button>
        )}
      </div>

      {/* Philosophy Intro */}
      <blockquote className="rounded-lg bg-background-secondary p-5 border border-tertiary italic text-sm text-text-secondary mb-8 leading-relaxed">
        "Some things are in our control and others not. Things in our control are opinion, pursuit, desire, aversion... Things not in our control are body, property, reputation, command..."
        <cite className="block text-right not-italic text-xs font-semibold mt-2 text-text-primary">— Epictetus, Enchiridion 1</cite>
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
            <Scale size={32} />
          </div>
          <h3 className="font-display text-xl text-text-primary mb-2">No Worries Logged</h3>
          <p className="text-sm text-text-secondary max-w-sm mb-6 leading-relaxed">
            Practice the Dichotomy of Control by logging and sorting your worries under the **Daily Reflection** tab.
          </p>
          <button
            onClick={() => setDemoMode(true)}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-background-primary hover:bg-accent-hover transition-colors"
          >
            See Demo Analytics
          </button>
        </div>
      ) : (
        /* Full Dashboard */
        <div className="space-y-6">
          {/* Ratio & Resolve Rate Summary Row */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            {/* Control Ratio Card */}
            <div className="rounded-xl border border-tertiary bg-background-secondary p-5 flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-widest font-semibold text-text-secondary block">Control Ratio</span>
                <h4 className="font-display text-lg text-text-primary mt-1 flex items-center gap-2">
                  🛡️ Internal vs. External Focus
                </h4>
              </div>
              
              <div className="my-5 space-y-3">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-success">Up to Me ({activeStats.upToMePercentage}%)</span>
                  <span className="text-energy">Not Up to Me ({activeStats.notUpToMePercentage}%)</span>
                </div>
                
                {/* Horizontal custom bar */}
                <div className="h-4 overflow-hidden rounded-full bg-background-tertiary border border-tertiary flex">
                  <div 
                    className="h-full bg-success transition-all duration-700 ease-out" 
                    style={{ width: `${activeStats.upToMePercentage}%` }} 
                  />
                  <div 
                    className="h-full bg-energy transition-all duration-700 ease-out" 
                    style={{ width: `${activeStats.notUpToMePercentage}%` }} 
                  />
                </div>
              </div>

              <div className="text-[10px] text-text-secondary/60 flex items-center gap-1.5 border-t border-tertiary/60 pt-2">
                <Info size={12} />
                Tracks your mental bandwidth allocation.
              </div>
            </div>

            {/* Resolve Rate Card */}
            <div className="rounded-xl border border-tertiary bg-background-secondary p-5 flex flex-col justify-between">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-widest font-semibold text-text-secondary block">Action Efficiency</span>
                <h4 className="font-display text-lg text-text-primary mt-1 flex items-center gap-2">
                  ✓ Action Resolution Rate
                </h4>
              </div>

              <div className="my-5 flex items-center gap-4">
                <div className="text-4xl font-display font-bold text-accent">
                  {activeStats.resolutionRate}%
                </div>
                <div className="text-xs text-text-secondary leading-relaxed">
                  You resolved <strong className="text-text-primary">{activeStats.resolvedUpToMe}</strong> of your <strong className="text-text-primary">{activeStats.upToMe.length}</strong> logged actionable concerns.
                </div>
              </div>

              <div className="text-[10px] text-text-secondary/60 flex items-center gap-1.5 border-t border-tertiary/60 pt-2">
                <Info size={12} />
                Measures execution of things within your control.
              </div>
            </div>
          </div>

          {/* Stoic Advice Callout */}
          {advice && (
            <div className={cn("rounded-xl border p-5 sm:p-6 shadow-sm", advice.style)}>
              <h3 className="font-display text-base font-semibold mb-2 flex items-center gap-2">
                <AlertCircle size={18} className="shrink-0" />
                {advice.title}
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                {advice.text}
              </p>
              <div className="border-t border-tertiary/60 pt-3 mt-3">
                <span className="text-xs font-semibold flex items-center gap-1.5 text-accent">
                  <Sparkles size={12} /> Stoic Action Exercise:
                </span>
                <p className="text-xs text-text-primary font-medium mt-1">
                  {advice.exercise}
                </p>
              </div>
            </div>
          )}

          {/* Word Clouds Section */}
          <div className="space-y-4">
            <h3 className="font-display text-lg text-text-primary">
              ☁ Mind mapping
            </h3>
            
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2">
              {/* Up to Me Cloud */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle2 size={16} />
                  <h4 className="text-sm font-semibold uppercase tracking-wider font-mono">Up to Me (Internals)</h4>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Common terms representing your choices, reactions, and efforts.
                </p>
                {renderWordCloud(activeStats.upToMeKeywords, 'text-success hover:text-success-hover')}
              </div>

              {/* Not Up to Me Cloud */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-energy">
                  <CloudFog size={16} />
                  <h4 className="text-sm font-semibold uppercase tracking-wider font-mono">Not Up to Me (Externals)</h4>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Common terms representing external circumstances and constraints.
                </p>
                {renderWordCloud(activeStats.notUpToMeKeywords, 'text-energy hover:text-energy-hover')}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
