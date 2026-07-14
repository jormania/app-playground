import { 
  Globe, 
  Award, 
  Users, 
  Clock, 
  Lock 
} from 'lucide-react';

interface FateGraphProps {
  records: Array<{ acceptanceTags?: string[] }>;
}

export default function FateGraph({ records }: FateGraphProps) {
  const counts: Record<string, number> = {
    Situation: 0,
    Outcome: 0,
    People: 0,
    Time: 0,
    Limitation: 0,
  };

  const icons: Record<string, any> = {
    Situation: Globe,
    Outcome: Award,
    People: Users,
    Time: Clock,
    Limitation: Lock,
  };

  let totalAcceptances = 0;
  let totalTagsCount = 0;

  records.forEach((rec) => {
    const tags = rec.acceptanceTags || [];
    if (tags.length > 0) {
      totalAcceptances++;
    }
    tags.forEach((tag) => {
      if (tag in counts) {
        counts[tag]++;
        totalTagsCount++;
      }
    });
  });

  return (
    <div className="rounded-xl bg-background-secondary border border-tertiary p-6 h-full flex flex-col justify-between">
      <div>
        <h3 className="font-display text-xl text-text-primary mb-1">
          📊 Amor Fati Focus
        </h3>
        <p className="text-sm text-text-secondary mb-6">
          Challenge types accepted so far ({totalAcceptances} total events)
        </p>
      </div>

      {totalAcceptances === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed border-tertiary p-6 text-center">
          <img src="/daily-stoic-empty-state.png" alt="Empty focus" className="w-24 h-24 mb-4 object-contain opacity-80" />
          <p className="text-sm font-medium text-text-secondary">Embrace friction to see your data here.</p>
          <p className="text-xs text-text-secondary mt-1">Add Acceptance Tags to your daily reflections.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {Object.entries(counts).map(([tag, count]) => {
            // Bar width must match the printed percentage exactly — it's a
            // share of the total, not scaled relative to the top category,
            // or a "25%" label would render as a visually full bar.
            const tagPercentage = totalTagsCount > 0 ? Math.round((count / totalTagsCount) * 100) : 0;
            const barWidthPercent = tagPercentage;
            const Icon = icons[tag] || Globe;
            
            return (
              <div key={tag} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 font-medium text-text-secondary flex items-center gap-2">
                  <Icon size={15} className="text-accent shrink-0" strokeWidth={2.5} />
                  <span>{tag}</span>
                </span>
                <div className="flex flex-1 items-center gap-2">
                  <div className="flex-1 h-2.5 overflow-hidden rounded-full bg-background-tertiary border border-tertiary">
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out bg-accent"
                      style={{ width: `${barWidthPercent}%` }}
                    />
                  </div>
                  <span className="w-20 shrink-0 text-right font-medium font-mono text-text-secondary">
                    {count} ({tagPercentage}%)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
