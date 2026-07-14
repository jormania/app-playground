import { useState, useMemo } from 'react';
import { StreakCounter } from '../../ds';
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

  // Filter reflections based on insight period, by actual calendar date
  const filteredReflections = useMemo(() => {
    if (insightPeriod === 'all') return recentReflections;
    const periodDays = parseInt(insightPeriod, 10);
    const now = new Date();
    return recentReflections.filter(r => {
      if (!r.date) return true;
      const recordDate = new Date(r.date + 'T00:00:00');
      const diffDays = (now.getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays <= periodDays;
    });
  }, [recentReflections, insightPeriod]);

  // Insights Review Data
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
          <div className="flex items-center justify-end mb-4 sm:mb-6">
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

      <div className="mb-6 sm:mb-8 grid gap-4 grid-cols-1 sm:grid-cols-2">
        <FateGraph records={filteredReflections} />
        <MoodGraph records={filteredReflections} />
      </div>
    </div>
  );
}
