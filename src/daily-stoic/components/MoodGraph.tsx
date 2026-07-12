import { 
  SmilePlus, 
  Smile, 
  Meh, 
  Frown, 
  Angry 
} from 'lucide-react';

interface MoodGraphProps {
  records: Array<{ mood?: string }>;
}

export default function MoodGraph({ records }: MoodGraphProps) {
  const counts: Record<string, number> = {
    'Great': 0,
    'Good': 0,
    'Neutral': 0,
    'Bad': 0,
    'Awful': 0,
  };

  const icons: Record<string, any> = {
    'Great': SmilePlus,
    'Good': Smile,
    'Neutral': Meh,
    'Bad': Frown,
    'Awful': Angry,
  };

  const labels: Record<string, string> = {
    'Great': 'Great',
    'Good': 'Good',
    'Neutral': 'Neutral',
    'Bad': 'Bad',
    'Awful': 'Awful',
  };

  let totalLogged = 0;
  records.forEach((rec) => {
    const mood = rec.mood;
    if (mood && mood in counts) {
      counts[mood]++;
      totalLogged++;
    }
  });

  const maxVal = Math.max(...Object.values(counts), 1);

  return (
    <div className="rounded-xl bg-background-secondary border border-tertiary p-6 h-full flex flex-col justify-between">
      <div>
        <h3 className="font-display text-xl text-text-primary mb-1">
          🎭 Mood Tracker
        </h3>
        <p className="text-sm text-text-secondary mb-6">
          Mood distribution ({totalLogged} total logged)
        </p>
      </div>

      {totalLogged === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed border-tertiary p-6 text-center">
          <span className="text-3xl mb-2" role="img" aria-label="mask">🎭</span>
          <p className="text-sm font-medium text-text-secondary">Your mood chart is empty.</p>
          <p className="text-xs text-text-secondary mt-1">Log your mood during the Evening Review to track trends.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {Object.keys(counts).map((key) => {
            const count = counts[key];
            const barWidthPercent = (count / maxVal) * 100;
            const moodPercentage = totalLogged > 0 ? Math.round((count / totalLogged) * 100) : 0;
            const Icon = icons[key] || Meh;
            
            return (
              <div key={key} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 font-medium text-text-secondary flex items-center gap-2">
                  <Icon size={16} className="text-accent shrink-0" strokeWidth={2.5} />
                  <span>{labels[key]}</span>
                </span>
                <div className="flex flex-1 items-center gap-2">
                  <div className="flex-1 h-2.5 overflow-hidden rounded-full bg-background-tertiary border border-tertiary">
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out bg-accent"
                      style={{ width: `${barWidthPercent}%` }}
                    />
                  </div>
                  <span className="w-20 shrink-0 text-right font-medium font-mono text-text-secondary">
                    {count} ({moodPercentage}%)
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
