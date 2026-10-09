import { useId } from 'react'
import type { Level } from '../domain/types'
import { LEVELS } from '../domain/exploration'
import s from '../styles/editorial.module.css'

/**
 * A five-step scale: five stops on a line, tapped rather than dragged (a drag
 * control in a scrolling page fights the scroll on a phone). The ends are
 * named, and the chosen level is spelled out below in words.
 */
export function LevelScale({ label, value, onChange, low, high, names, describe }: {
  label: string
  value: Level
  onChange: (v: Level) => void
  low: string
  high: string
  names: Record<Level, { label: string }>
  describe: (v: Level) => string
}) {
  const id = useId()
  return (
    <div className={s.scale}>
      <p className={s.scaleLabel} id={id}>{label}</p>
      <div className={s.scaleTrack} role="radiogroup" aria-labelledby={id}>
        {LEVELS.map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={value === l}
            aria-label={`${l} — ${names[l].label}`}
            className={`${s.scaleStop} ${value === l ? s.scaleOn : ''} ${l < value ? s.scalePast : ''}`}
            onClick={() => onChange(l)}
          />
        ))}
      </div>
      <div className={s.scaleEnds}><span>{low}</span><span>{high}</span></div>
      <p className={s.scaleNow}><strong>{names[value].label}.</strong> {describe(value)}</p>
    </div>
  )
}
