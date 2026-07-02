import { useState } from 'react'
import { Button, NumberStepper } from '../../ds'
import { buildCycleSegments } from '../lib/segments'
import { loadModeConfig, saveModeConfig } from '../lib/storage'
import styles from './Setup.module.css'

// The classic Pomodoro Technique (25/5 focus/break, 15min long break every
// 4th cycle) is just this mode's factory default, mirroring how Tabata is
// Rounds' default preset — no separate Pomodoro code path.
const DEFAULTS = { focus: 25, shortBreak: 5, longBreak: 15, cyclesBeforeLongBreak: 4, totalCycles: 8 }

export function CyclesSetup({ onStart, onBack }) {
  const [config, setConfig] = useState(() => loadModeConfig('cycles', DEFAULTS))

  function set(key, value) {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const clamped = {
      focus: Math.max(1, config.focus || 0),
      shortBreak: Math.max(1, config.shortBreak || 0),
      longBreak: Math.max(1, config.longBreak || 0),
      cyclesBeforeLongBreak: Math.max(1, config.cyclesBeforeLongBreak || 0),
      totalCycles: Math.max(1, config.totalCycles || 0),
    }
    saveModeConfig('cycles', clamped)
    onStart(
      buildCycleSegments({
        focus: clamped.focus * 60,
        shortBreak: clamped.shortBreak * 60,
        longBreak: clamped.longBreak * 60,
        cyclesBeforeLongBreak: clamped.cyclesBeforeLongBreak,
        totalCycles: clamped.totalCycles,
      }),
    )
  }

  return (
    <div className={styles.page}>
      <form className={styles.panel} onSubmit={handleSubmit}>
        <div className={styles.header}>
          <Button type="button" variant="ghost" size="sm" onClick={onBack}>← Back</Button>
          <h1 className={styles.title}>Cycles</h1>
        </div>

        <div className={styles.form}>
          <div className={styles.row}>
            <NumberStepper
              label="Focus (min)"
              min={1}
              max={120}
              value={config.focus}
              onChange={(v) => set('focus', v)}
            />
            <NumberStepper
              label="Short break (min)"
              min={1}
              max={60}
              value={config.shortBreak}
              onChange={(v) => set('shortBreak', v)}
            />
          </div>
          <div className={styles.row}>
            <NumberStepper
              label="Long break (min)"
              min={1}
              max={60}
              value={config.longBreak}
              onChange={(v) => set('longBreak', v)}
            />
            <NumberStepper
              label="Long break every (cycles)"
              min={1}
              max={20}
              value={config.cyclesBeforeLongBreak}
              onChange={(v) => set('cyclesBeforeLongBreak', v)}
            />
          </div>
          <div className={styles.row}>
            <NumberStepper
              label="Total cycles"
              min={1}
              max={40}
              value={config.totalCycles}
              onChange={(v) => set('totalCycles', v)}
            />
          </div>
        </div>

        <Button type="submit" className={styles.submit}>Start</Button>
      </form>
    </div>
  )
}
