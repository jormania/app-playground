import { useMemo, useState } from 'react'
import { Button, NumberStepper } from '../../ds'
import { loadModeConfig, saveModeConfig } from '../lib/storage'
import { DurationPill } from './DurationPill'
import { sumSeconds } from '../lib/duration'
import styles from './Setup.module.css'

// One setup screen for every numeric preset (Rounds, Cycles, Sit–Walk, 4-7-8,
// Box). It renders the mode's declared `fields` as NumberSteppers, remembers the
// last-used config per mode, and hands the built segments to the Player. The
// mode registry owns everything mode-specific; this component owns none of it.
export function PresetSetup({ mode, onStart, onBack }) {
  const [config, setConfig] = useState(() => loadModeConfig(mode.id, mode.defaults))

  // Live total — rebuilt from the same `build()` the mode will actually run,
  // so what's shown here always matches what Begin hands to the Player.
  const totalDurationSeconds = useMemo(() => sumSeconds(mode.build(config)), [mode, config])

  function set(key, value) {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    // Clamp to each field's declared bounds before saving/building.
    const clean = {}
    for (const f of mode.fields) {
      const raw = Number(config[f.key])
      const v = Number.isFinite(raw) ? raw : mode.defaults[f.key]
      clean[f.key] = Math.min(f.max, Math.max(f.min, v))
    }
    saveModeConfig(mode.id, clean)
    onStart(mode.build(clean))
  }

  return (
    <div className={styles.page}>
      <form className={styles.panel} onSubmit={handleSubmit}>
        <div className={styles.header}>
          <h1 className={styles.title}>{mode.name}</h1>
          <DurationPill seconds={totalDurationSeconds} className={styles.headerDuration} />
        </div>

        <p className={styles.lede}>{mode.blurb}</p>

        <div className={styles.form}>
          <div className={styles.row}>
            {mode.fields.map((f) => (
              <NumberStepper
                key={f.key}
                label={f.label}
                min={f.min}
                max={f.max}
                value={config[f.key]}
                onChange={(v) => set(f.key, v)}
              />
            ))}
          </div>
        </div>

        <div className={styles.actions}>
          <Button type="button" variant="secondary" className={styles.back} onClick={onBack}>
            Back
          </Button>
          <Button type="submit" className={styles.submit}>
            Begin
          </Button>
        </div>
      </form>
    </div>
  )
}
