import styles from '../App.module.css';

interface MementoMoriProps {
  birthDateString: string;
  onGoToSettings: () => void;
}

export default function MementoMori({ birthDateString, onGoToSettings }: MementoMoriProps) {
  if (!birthDateString) {
    return (
      <div className={styles.mementoMoriCard}>
        <h3 className={styles.mementoMoriTitle}>💀 Memento Mori</h3>
        <p className={styles.mementoMoriIntro}>
          "Remember you must die." A visual representation of your life in weeks.
        </p>
        <div className={styles.mementoMoriPlaceholder}>
          <p className={styles.placeholderText}>
            Configure your birth date in settings to visualize your Memento Mori life calendar.
          </p>
          <button onClick={onGoToSettings} className={styles.pillButton}>
            ⚙️ Go to Settings
          </button>
        </div>
      </div>
    );
  }

  const birthDate = new Date(birthDateString);
  const today = new Date();
  
  // Lifespan definition (80 years)
  const totalYears = 80;
  const totalWeeks = totalYears * 52; // 4160 weeks

  // Calculate elapsed weeks
  const diffMs = today.getTime() - birthDate.getTime();
  const weeksElapsed = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24 * 7)));
  
  const percentage = Math.min(100, Math.max(0, (weeksElapsed / totalWeeks) * 100));

  // We can group blocks in 80 rows of 52 weeks or render a grid directly.
  // Drawing 4160 blocks in a optimized CSS Grid.
  const blocks = [];
  for (let i = 0; i < totalWeeks; i++) {
    const elapsed = i < weeksElapsed;
    blocks.push(
      <div
        key={i}
        className={`${styles.lifeBlock} ${elapsed ? styles.lifeBlockFilled : styles.lifeBlockEmpty}`}
        title={`Week ${i + 1} of ${totalWeeks} (${elapsed ? 'Elapsed' : 'Remaining'})`}
      />
    );
  }

  return (
    <div className={styles.mementoMoriCard}>
      <h3 className={styles.mementoMoriTitle}>💀 Memento Mori</h3>
      <p className={styles.mementoMoriIntro}>
        "Let us prepare our minds as if we’d come to the very end of life." — Seneca
      </p>

      <div className={styles.mementoMoriStats}>
        <span className={styles.statLabel}>Weeks elapsed: <strong>{weeksElapsed}</strong> / {totalWeeks}</span>
        <span className={styles.statLabel}>Life progress: <strong>{percentage.toFixed(1)}%</strong></span>
      </div>

      <div className={styles.mementoMoriGrid}>
        {blocks}
      </div>

      <p className={styles.gridHint}>
        Each block represents one week of an 80-year lifespan. Live today as if it were a gift.
      </p>
    </div>
  );
}
