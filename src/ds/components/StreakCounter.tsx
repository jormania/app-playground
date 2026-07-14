import { cx } from '../lib/cx';
import styles from './StreakCounter.module.css';

export interface StreakCounterProps extends React.HTMLAttributes<HTMLDivElement> {
  count: number;
  label?: string;
}

export function StreakCounter({ count, label = 'Reflection Streak', className, ...props }: StreakCounterProps) {
  return (
    <div className={cx(styles.container, className)} {...props}>
      <span className={styles.fireEmoji} role="img" aria-label="streak fire">🔥</span>
      <div className={styles.details}>
        <div className={styles.countRow}>
          <span className={styles.count}>{count}</span>
          <span className={styles.unit}>{count === 1 ? 'day' : 'days'}</span>
        </div>
        <span className={styles.label}>{label}</span>
      </div>
    </div>
  );
}
