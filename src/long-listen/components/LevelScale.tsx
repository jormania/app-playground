import { useId } from 'react'
import type { Level } from '../domain/types'
import { LEVELS } from '../domain/exploration'
import s from '../styles/editorial.module.css'

/**
 * A five-step scale: five stops on a line, tapped rather than dragged (a drag
 * control in a scrolling page fights the scroll on a phone). The ends carry
 * the names of the first and last levels, and the chosen level is spelled out
 * below in a sentence. Its name stays on the stop, for a screen reader: said
 * before the sentence too, it read "One focus. One focus — …".
 */
export function LevelScale({ label, value, onChange, names, describe }: {
  label: string
  value: Level
  onChange: (v: Level) => void
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
      <div className={s.scaleEnds}><span>{names[1].label}</span><span>{names[5].label}</span></div>
      <p className={s.scaleNow}>{describe(value)}</p>
    </div>
  )
}
