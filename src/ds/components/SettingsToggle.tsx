import { useId } from 'react';
import { cx } from '../lib/cx';
import styles from './SettingsToggle.module.css';

export interface SettingsToggleProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  hint?: string;
}

export function SettingsToggle({ label, hint, checked, onChange, className, ...props }: SettingsToggleProps) {
  const id = useId();
  return (
    <div className={cx(styles.container, className)}>
      <div className={styles.info}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        {hint && <span className={styles.hint}>{hint}</span>}
      </div>
      <label className={styles.switch}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className={styles.input}
          {...props}
        />
        <span className={styles.slider} />
      </label>
    </div>
  );
}
