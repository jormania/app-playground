import { useState } from 'react'
import { Button, NumberStepper } from '../../ds'
import { buildRoundsSegments } from '../lib/segments'
import { loadModeConfig, saveModeConfig } from '../lib/storage'
import styles from './Setup.module.css'

// Tabata's 20s work / 10s rest / 8 rounds is just this mode's factory default —
// there's no separate Tabata code path.
const DEFAULTS = { work: 20, rest: 10, rounds: 8, warmup: 0 }

export function RoundsSetup({ onStart, onBack }) {
  const [config, setConfig] = useState(() => loadModeConfig('rounds', DEFAULTS))

  function set(key, value) {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const clamped = {
      work: Math.max(1, config.work || 0),
      rest: Math.max(1, config.rest || 0),
      rounds: Math.max(1, config.rounds || 0),
      warmup: Math.max(0, config.warmup || 0),
    }
    saveModeConfig('rounds', clamped)
    onStart(buildRoundsSegments(clamped))
  }

  return (
    <div className={styles.page}>
      <form className={styles.panel} onSubmit={handleSubmit}>
        <div className={styles.header}>
          <Button type="button" variant="ghost" size="sm" onClick={onBack}>← Back</Button>
          <h1 className={styles.title}>Rounds</h1>
        </div>

        <div className={styles.form}>
          <div className={styles.row}>
            <NumberStepper label="Work (sec)" min={1} max={300} value={config.work} onChange={(v) => set('work', v)} />
            <NumberStepper label="Rest (sec)" min={1} max={300} value={config.rest} onChange={(v) => set('rest', v)} />
          </div>
          <div className={styles.row}>
            <NumberStepper label="Rounds" min={1} max={50} value={config.rounds} onChange={(v) => set('rounds', v)} />
            <NumberStepper
              label="Warmup (sec)"
              min={0}
              max={300}
              value={config.warmup}
              onChange={(v) => set('warmup', v)}
            />
          </div>
        </div>

        <Button type="submit" className={styles.submit}>Start</Button>
      </form>
    </div>
  )
}
