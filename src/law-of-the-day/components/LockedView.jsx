import styles from './LockedView.module.css'

export function LockedView({ law, lastResult, streak }) {
  return (
    <div className={styles.view}>
      <p className={styles.eyebrow}>Come back tomorrow</p>
      <p className={styles.streak}>
        {streak} day{streak === 1 ? '' : 's'} streak
      </p>
      {lastResult && (
        <p className={lastResult.correct ? styles.recapCorrect : styles.recapIncorrect}>
          {lastResult.correct ? 'You got today\'s law right' : 'Not quite today'} — Law{' '}
          {law.lawNumber}: {law.lawTitle}
        </p>
      )}
      <p className={styles.subtext}>A new scenario unlocks after midnight, your time.</p>
    </div>
  )
}
