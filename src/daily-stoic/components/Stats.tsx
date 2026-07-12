import { useState, useMemo } from 'react';
import { StreakCounter } from './StreakCounter';
import FateGraph from './FateGraph';
import MoodGraph from './MoodGraph';
import { ReflectionRecord } from '../services/NotionService';
import { getDayOfYear } from '../utils/date';
import { cn } from '../lib/cn';

interface StatsProps {
  streak: number;
  recentReflections: ReflectionRecord[];
  onClose: () => void;
}

export default function Stats({ streak, recentReflections, onClose }: StatsProps) {
  const [insightPeriod, setInsightPeriod] = useState<'7' | '30'>('7');
  
  // 1. Consistency Graph Data
  const weeks = useMemo(() => {
    const cols = [];
    for (let w = 0; w < 53; w++) {
      const days = [];
      for (let d = 0; d < 7; d++) {
        const dayOfYear = w * 7 + d + 1;
        if (dayOfYear > 366) break;
        
        // Find if reflection exists for this day
        // For accurate tracking we should also check local storage in a real app,
        // but recentReflections contains all synced data which is the primary source of truth.
        const hasLog = recentReflections.some(r => r.quoteId === dayOfYear);
        
        days.push(
          <div 
            key={dayOfYear} 
            className={cn(
              "h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0 rounded-[2px] transition-colors",
              hasLog ? "bg-accent shadow-[0_0_8px_var(--color-accent-soft)]" : "bg-background-tertiary hover:bg-border-tertiary"
            )} 
            title={`Day ${dayOfYear}${hasLog ? ': Journaled' : ''}`}
          />
        );
      }
      cols.push(<div key={w} className="flex flex-col gap-1 shrink-0">{days}</div>);
    }
    return cols;
  }, [recentReflections]);

  // 2. Insights Review Data
  const insights = useMemo(() => {
    const today = getDayOfYear();
    const periodDays = parseInt(insightPeriod, 10);
    
    // Handle wrap-around for end of year if necessary, but simple subtraction works for most of the year
    const records = recentReflections.filter(r => {
      const diff = today - r.quoteId;
      return diff >= 0 && diff < periodDays;
    });

    let words = 0;
    const moods: Record<string, number> = {};
    const tags: Record<string, number> = {};
    
    records.forEach(r => {
      if (r.text) words += r.text.trim().split(/\s+/).length;
      if (r.mood) moods[r.mood] = (moods[r.mood] || 0) + 1;
      if (r.acceptanceTags) {
        r.acceptanceTags.forEach(t => tags[t] = (tags[t] || 0) + 1);
      }
    });

    const dominantMood = Object.entries(moods).sort((a,b) => b[1] - a[1])[0]?.[0] || 'None';
    const dominantTag = Object.entries(tags).sort((a,b) => b[1] - a[1])[0]?.[0] || 'None';

    return { 
      words, 
      dominantMood, 
      dominantTag, 
      count: records.length,
      periodDays 
    };
  }, [recentReflections, insightPeriod]);

  return (
    <div className="mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-12 flex items-center justify-between border-b border-tertiary pb-8">
        <div>
          <h2 className="font-display text-2xl text-text-primary mb-4">Your Progress</h2>
          <p className="text-sm text-text-secondary mt-2">Consistency and alignment metrics</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-2 text-text-secondary hover:bg-background-tertiary transition-colors"
          title="Close Stats"
        >
          ✕
        </button>
      </div>

      <div className="mb-8 grid gap-4 grid-cols-1 sm:grid-cols-2">
        <div className="rounded-lg bg-background-secondary border border-tertiary p-6 flex flex-col justify-center">
          <StreakCounter count={streak} />
        </div>
        
        {/* Insights Review Block */}
        <div className="rounded-lg bg-background-secondary border border-tertiary p-5">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-display text-lg text-text-primary">Insights</h3>
            <div className="flex items-center gap-1 rounded-md bg-background-tertiary p-1 border border-tertiary">
              <button 
                onClick={() => setInsightPeriod('7')}
                className={cn("px-3 py-1 text-xs font-medium rounded-sm transition-all text-center min-w-[4rem]", insightPeriod === '7' ? 'bg-background-secondary text-text-primary shadow-sm border border-tertiary' : 'text-text-secondary hover:text-text-primary hover:bg-background-secondary/50 border border-transparent')}
              >
                7 Days
              </button>
              <button 
                onClick={() => setInsightPeriod('30')}
                className={cn("px-3 py-1 text-xs font-medium rounded-sm transition-all text-center min-w-[4rem]", insightPeriod === '30' ? 'bg-background-secondary text-text-primary shadow-sm border border-tertiary' : 'text-text-secondary hover:text-text-primary hover:bg-background-secondary/50 border border-transparent')}
              >
                30 Days
              </button>
            </div>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center border-b border-tertiary pb-2">
              <span className="text-text-secondary">Days Journaled</span>
              <span className="font-medium text-text-primary">{insights.count} / {insights.periodDays}</span>
            </div>
            <div className="flex justify-between items-center border-b border-tertiary pb-2">
              <span className="text-text-secondary">Dominant Mood</span>
              <span className="font-medium text-text-primary">{insights.dominantMood}</span>
            </div>
            <div className="flex justify-between items-center border-b border-tertiary pb-2">
              <span className="text-text-secondary">Primary Friction</span>
              <span className="font-medium text-text-primary">{insights.dominantTag}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-secondary">Words Written</span>
              <span className="font-medium text-text-primary">{insights.words.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-8 rounded-lg bg-background-secondary border border-tertiary p-5 sm:p-6">
        <h3 className="font-display text-lg text-text-primary mb-4">365-Day Consistency</h3>
        <div className="flex justify-center overflow-x-auto pb-2 custom-scrollbar">
          <div className="flex gap-1 min-w-max pr-2">
            {weeks}
          </div>
        </div>
      </div>

      <div className="mb-8 grid gap-4 grid-cols-1 sm:grid-cols-2">
        <FateGraph records={recentReflections} />
        <MoodGraph records={recentReflections} />
      </div>
    </div>
  );
}
