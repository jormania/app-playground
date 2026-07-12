import { useState, useMemo } from 'react';
import { StreakCounter } from './StreakCounter';
import FateGraph from './FateGraph';
import MoodGraph from './MoodGraph';
import { ReflectionRecord } from '../services/NotionService';
import { cn } from '../lib/cn';

interface StatsProps {
  streak: number;
  recentReflections: ReflectionRecord[];
  onClose: () => void;
}

export default function Stats({ streak, recentReflections, onClose }: StatsProps) {
  const [insightPeriod, setInsightPeriod] = useState<'30' | '90' | '365' | 'all'>('30');
  
  // 1. Calculate current day of the 365-day cycle
  const todayCycleDay = useMemo(() => {
    const cycleStartDate = localStorage.getItem('daily-stoic:cycle-start-date') || '';
    const today = new Date();
    if (!cycleStartDate) {
      const currentYear = today.getFullYear();
      const start = new Date(currentYear, 0, 1);
      const diff = today.getTime() - start.getTime();
      return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
    }
    const start = new Date(cycleStartDate);
    const startD = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const todayD = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const diff = todayD.getTime() - startD.getTime();
    const diffDays = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
    return (diffDays % 365) + 1;
  }, []);

  // 2. Consistency Graph Data (365 days)
  const weeks = useMemo(() => {
    const cols = [];
    for (let w = 0; w < 53; w++) {
      const days = [];
      for (let d = 0; d < 7; d++) {
        const dayOfYear = w * 7 + d + 1;
        if (dayOfYear > 365) break;
        
        const hasLog = recentReflections.some(r => r.quoteId === dayOfYear);
        const isToday = dayOfYear === todayCycleDay;
        
        days.push(
          <div 
            key={dayOfYear} 
            className={cn(
              "h-2.5 w-2.5 sm:h-3 sm:w-3 shrink-0 rounded-[2px] transition-all border",
              hasLog 
                ? "bg-accent border-accent/20 shadow-[0_0_8px_var(--color-accent-soft)]" 
                : "bg-background-tertiary border-transparent hover:bg-border-tertiary",
              isToday && "ring-2 ring-accent ring-offset-2 ring-offset-background-secondary animate-pulse"
            )} 
            title={`Day ${dayOfYear}${isToday ? ' (Today)' : ''}${hasLog ? ': Journaled' : ''}`}
          />
        );
      }
      cols.push(<div key={w} className="flex flex-col gap-1 shrink-0">{days}</div>);
    }
    return cols;
  }, [recentReflections, todayCycleDay]);

  // 3. Filter reflections based on insight period
  const filteredReflections = useMemo(() => {
    const periodDays = insightPeriod === 'all' ? 366 : parseInt(insightPeriod, 10);
    return recentReflections.filter(r => {
      if (insightPeriod === 'all') return true;
      const diff = todayCycleDay - r.quoteId;
      // Handle cycle wrap around (365 days)
      const normalizedDiff = diff >= 0 ? diff : (365 + diff);
      return normalizedDiff < periodDays;
    });
  }, [recentReflections, insightPeriod, todayCycleDay]);

  // 4. Insights Review Data
  const insights = useMemo(() => {
    const periodDays = insightPeriod === 'all' ? 365 : parseInt(insightPeriod, 10);
    
    let words = 0;
    const moods: Record<string, number> = {};
    const tags: Record<string, number> = {};
    
    filteredReflections.forEach(r => {
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
      count: filteredReflections.length,
      periodDays 
    };
  }, [filteredReflections, insightPeriod]);

  return (
    <div className="mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-6 sm:mb-12 flex items-center justify-between border-b border-tertiary pb-4 sm:pb-8">
        <div>
          <h2 className="font-display text-xl sm:text-2xl text-text-primary mb-2 sm:mb-4">Your Progress</h2>
          <p className="text-sm text-text-secondary mt-1 sm:mt-2">Consistency and alignment metrics</p>
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
        <div className="rounded-lg bg-background-secondary border border-tertiary p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h3 className="font-display text-lg text-text-primary">Insights</h3>
            <div className="flex items-center gap-1 rounded-md bg-background-tertiary p-1 border border-tertiary overflow-x-auto max-w-full">
              {(['30', '90', '365', 'all'] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setInsightPeriod(period)}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-sm transition-all text-center min-w-[3.5rem]",
                    insightPeriod === period
                      ? 'bg-background-secondary text-text-primary shadow-sm border border-tertiary'
                      : 'text-text-secondary hover:text-text-primary hover:bg-background-secondary/50 border border-transparent'
                  )}
                >
                  {period === 'all' ? 'All' : `${period}d`}
                </button>
              ))}
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

      <div className="mb-6 sm:mb-8 rounded-lg bg-background-secondary border border-tertiary p-4 sm:p-6">
        <h3 className="font-display text-lg text-text-primary mb-4">365-Day Consistency</h3>
        <div className="flex justify-center overflow-x-auto pb-2 custom-scrollbar">
          <div className="flex gap-1 min-w-max pr-2">
            {weeks}
          </div>
        </div>
      </div>

      <div className="mb-6 sm:mb-8 grid gap-4 grid-cols-1 sm:grid-cols-2">
        <FateGraph records={filteredReflections} />
        <MoodGraph records={filteredReflections} />
      </div>
    </div>
  );
}
