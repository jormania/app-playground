import styles from '../App.module.css';

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
    <div className={styles.fateGraphCard}>
      <h3 className={styles.fateGraphTitle}>
        📊 Amor Fati Focus
      </h3>
      <p className={styles.fateGraphIntro}>
        Challenge types accepted so far ({totalAcceptances} total events)
      </p>

      <div className={styles.chartContainer}>
        {Object.entries(counts).map(([tag, count]) => {
          const percentage = (count / maxVal) * 100;
          return (
            <div key={tag} className={styles.chartRow}>
              <span className={styles.chartLabel}>{tag}</span>
              <div className={styles.chartBarWrapper}>
                <div
                  className={styles.chartBar}
                  style={{ width: `${percentage}%` }}
                />
                <span className={styles.chartCount}>{count}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
