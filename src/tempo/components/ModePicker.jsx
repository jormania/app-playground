import { Card } from '../../ds'
import { loadModeConfig } from '../lib/storage'
import styles from './ModePicker.module.css'

const MODES = [
  {
    id: 'rounds',
    emoji: '🔁',
    title: 'Rounds',
    blurb: 'Work/rest intervals, repeated. Set it to 20s/10s × 8 for Tabata, or anything else.',
    summarize: (c) => (c ? `Last: ${c.work}s work / ${c.rest}s rest × ${c.rounds}` : null),
  },
  {
    id: 'cycles',
    emoji: '🎯',
    title: 'Cycles',
    blurb: 'Focus/break blocks with a longer break every few cycles. Defaults to the classic Pomodoro.',
    summarize: (c) => (c ? `Last: ${c.focus}m focus / ${c.shortBreak}m break × ${c.totalCycles}` : null),
  },
  {
    id: 'custom',
    emoji: '🛠',
    title: 'Custom',
    blurb: 'Build your own sequence — any labels, any durations, any order.',
    summarize: (c) => (c ? `Last: ${c.length} segment${c.length === 1 ? '' : 's'}` : null),
  },
]

export function ModePicker({ onSelect }) {
  return (
    <div className={styles.page}>
      <div className={styles.heading}>
        <h1 className={styles.title}>Tempo</h1>
        <p className={styles.subtitle}>Set your intervals and go.</p>
      </div>
      <div className={styles.grid}>
        {MODES.map((mode) => {
          const saved = loadModeConfig(mode.id, null)
          const summary = mode.summarize(saved)
          return (
            <Card key={mode.id} onClick={() => onSelect(mode.id)}>
              <span className={styles.emoji} aria-hidden>{mode.emoji}</span>
              <h2 className={styles.cardTitle}>{mode.title}</h2>
              <p className={styles.cardBlurb}>{mode.blurb}</p>
              {summary && <p className={styles.lastUsed}>{summary}</p>}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
