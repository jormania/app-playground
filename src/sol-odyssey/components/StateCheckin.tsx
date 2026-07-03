import { useState } from 'react'
import { Check, Wind } from 'lucide-react'
import { cn } from '../lib/cn'
import { SupportingNote } from './SupportingNote'
import {
  STATE_WORDS,
  INTENSITY_LEVELS,
  closingLine,
  EMPTY_STATE_CHECKIN_SELECTION,
  type StateCheckinSelection,
  type StateWord,
  type Intensity,
} from '../lib/stateCheckin'

function Pill<T extends string>({
  value,
  label,
  selected,
  onSelect,
}: {
  value: T
  label: string
  selected: boolean
  onSelect: (value: T) => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(value)}
      className={cn(
        'flex items-center gap-1.5 rounded-pill border px-3 py-1.5 font-sans text-sm transition-colors duration-fast',
        selected
          ? 'border-accent bg-accent-soft text-accent'
          : 'border-secondary text-text-primary hover:bg-background-tertiary',
      )}
    >
      {selected && <Check size={13} aria-hidden />}
      {label}
    </button>
  )
}

/** A private, on-device-only moment before the daily check-in: name what's here, gauge it, then
 *  choose what you'd rather feel. No props, no persistence — local state only, gone on remount. */
export function StateCheckin() {
  const [selection, setSelection] = useState<StateCheckinSelection>(EMPTY_STATE_CHECKIN_SELECTION)
  const line = closingLine(selection)
  const hasAny = selection.named || selection.intensity || selection.desired

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-dashed border-tertiary bg-background-secondary p-5">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Wind size={16} className="text-text-secondary" aria-hidden />
          <h3 className="font-display text-base">A moment, first</h3>
        </div>
        <p className="font-sans text-sm text-text-secondary">
          Before you log, thirty seconds to notice where you are — nothing here is saved.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="font-mono text-xs uppercase tracking-wide text-text-secondary">Name what's here</p>
        <div className="flex flex-wrap gap-1.5">
          {STATE_WORDS.map((word) => (
            <Pill<StateWord>
              key={word}
              value={word}
              label={word}
              selected={selection.named === word}
              onSelect={(v) => setSelection((s) => ({ ...s, named: v }))}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="font-mono text-xs uppercase tracking-wide text-text-secondary">How strong</p>
        <div className="flex flex-wrap gap-1.5">
          {INTENSITY_LEVELS.map((level) => (
            <Pill<Intensity>
              key={level.value}
              value={level.value}
              label={level.label}
              selected={selection.intensity === level.value}
              onSelect={(v) => setSelection((s) => ({ ...s, intensity: v }))}
            />
          ))}
        </div>
      </div>

      <p className="font-sans text-sm text-text-secondary">
        Take a slow breath. Notice it in your body too, without needing to change it yet.
      </p>

      <div className="flex flex-col gap-1.5">
        <p className="font-mono text-xs uppercase tracking-wide text-text-secondary">Choose instead</p>
        <div className="flex flex-wrap gap-1.5">
          {STATE_WORDS.map((word) => (
            <Pill<StateWord>
              key={word}
              value={word}
              label={word}
              selected={selection.desired === word}
              onSelect={(v) => setSelection((s) => ({ ...s, desired: v }))}
            />
          ))}
        </div>
      </div>

      {line && <p className="font-sans text-sm font-medium text-text-primary">{line}</p>}

      <div className="flex items-center justify-between gap-3">
        {hasAny ? (
          <button
            type="button"
            onClick={() => setSelection(EMPTY_STATE_CHECKIN_SELECTION)}
            className="font-sans text-sm text-text-secondary underline underline-offset-2 hover:text-text-primary"
          >
            Clear
          </button>
        ) : (
          <span />
        )}
        <span className="font-mono text-xs text-text-secondary">Not saved — just for now.</span>
      </div>

      <SupportingNote note="stateCheckin" />
    </div>
  )
}
