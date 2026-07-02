import { Card } from '../../ds'
import styles from './ScenarioView.module.css'

export function ScenarioView({ law, options, onAnswer }) {
  return (
    <div className={styles.view}>
      <p className={styles.eyebrow}>Today's scenario</p>
      <p className={styles.scenario}>{law.scenarioText}</p>
      <p className={styles.prompt}>Which law is at play?</p>
      <div className={styles.options}>
        {options.map((option) => (
          <Card key={option.id} className={styles.option} onClick={() => onAnswer(option.id)}>
            {option.title}
          </Card>
        ))}
      </div>
    </div>
  )
}
