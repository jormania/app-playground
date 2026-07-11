import styles from '../App.module.css';

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

  const labels: Record<string, string> = {
    'Great': '🤩 Great',
    'Good': '🙂 Good',
    'Neutral': '😐 Neutral',
    'Bad': '😔 Bad',
    'Awful': '😠 Awful',
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
    <div className={styles.fateGraphCard}>
      <h3 className={styles.fateGraphTitle}>
        🎭 Mood Tracker
      </h3>
      <p className={styles.fateGraphIntro}>
        Mood distribution ({totalLogged} total logged)
      </p>

      <div className={styles.chartContainer}>
        {Object.keys(counts).map((key) => {
          const count = counts[key];
          const percentage = (count / maxVal) * 100;
          return (
            <div key={key} className={styles.chartRow}>
              <span className={styles.chartLabel} style={{ width: '90px' }}>{labels[key]}</span>
              <div className={styles.chartBarWrapper}>
                <div
                  className={styles.chartBar}
                  style={{ width: `${percentage}%`, background: 'var(--primary)' }}
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
