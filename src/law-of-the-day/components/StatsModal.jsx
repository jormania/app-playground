import { Modal } from '../../ds'
import styles from './StatsModal.module.css'

export function StatsModal({ open, onClose, streak, stats }) {
  return (
    <Modal open={open} onClose={onClose} title="Your stats">
      <div className={styles.summaryRow}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{streak}</span>
          <span className={styles.statLabel}>day streak</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{stats.lawsSeen}/{stats.totalLaws}</span>
          <span className={styles.statLabel}>laws seen</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{stats.accuracyPercent}%</span>
          <span className={styles.statLabel}>accuracy</span>
        </div>
      </div>
      {stats.perLaw.length > 0 ? (
        <ul className={styles.lawList}>
          {stats.perLaw.map((entry) => (
            <li key={entry.lawId} className={styles.lawRow}>
              <span className={styles.lawTitle}>
                Law {entry.lawNumber} — {entry.lawTitle}
              </span>
              <span className={entry.lastAnsweredCorrect ? styles.correct : styles.incorrect}>
                {entry.correctCount}/{entry.correctCount + entry.incorrectCount}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>Answer today's law to start building your stats.</p>
      )}
    </Modal>
  )
}
