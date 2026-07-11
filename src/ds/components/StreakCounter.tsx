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
        <span className={styles.count}>{count}</span>
        <span className={styles.label}>{count === 1 ? `${label} (1 day)` : `${label} (${count} days)`}</span>
      </div>
    </div>
  );
}
