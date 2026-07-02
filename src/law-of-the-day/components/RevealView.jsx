import { Button } from '../../ds'
import styles from './RevealView.module.css'

export function RevealView({ law, correct, onContinue }) {
  return (
    <div className={styles.view}>
      <p className={correct ? styles.resultCorrect : styles.resultIncorrect}>
        {correct ? 'Correct' : 'Not quite'}
      </p>
      <p className={styles.lawNumber}>Law {law.lawNumber}</p>
      <h2 className={styles.lawTitle}>{law.lawTitle}</h2>
      <p className={styles.explanation}>{law.explanationText}</p>
      <Button className={styles.continue} onClick={onContinue}>
        Continue
      </Button>
    </div>
  )
}
