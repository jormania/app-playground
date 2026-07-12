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

  let totalAcceptances = 0;
  records.forEach((rec) => {
    const tags = rec.acceptanceTags || [];
    if (tags.length > 0) {
      totalAcceptances++;
    }
    tags.forEach((tag) => {
      if (tag in counts) {
        counts[tag]++;
      }
    });
  });

  const maxVal = Math.max(...Object.values(counts), 1);

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
          <span className="text-3xl mb-2" role="img" aria-label="mountain">⛰️</span>
          <p className="text-sm font-medium text-text-secondary">Embrace friction to see your data here.</p>
          <p className="text-xs text-text-secondary mt-1">Add Acceptance Tags to your daily reflections.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {Object.entries(counts).map(([tag, count]) => {
            const percentage = (count / maxVal) * 100;
            return (
              <div key={tag} className="flex items-center gap-3 text-sm">
                <span className="w-20 shrink-0 font-medium text-text-secondary">{tag}</span>
                <div className="flex flex-1 items-center gap-2">
                  <div className="flex-1 h-2.5 overflow-hidden rounded-full bg-background-tertiary border border-tertiary">
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out bg-accent"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="w-4 shrink-0 text-right font-medium text-text-secondary">{count}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
