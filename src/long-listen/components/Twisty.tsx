import { useEffect, useState, type ReactNode } from 'react'
import { readJson, writeJson } from '../../shared/storage'
import s from '../styles/editorial.module.css'

const READ_PREFIX = 'long-listen:read:'

/**
 * A twisty: a folded block whose one line says what is inside ("Made with your
 * settings · 4–5 h · Several · A mix"), opened only when wanted. The one way the
 * app folds anything, so every screen folds alike.
 *
 * `readOnce` is for writing that is worth reading once and is in the way after:
 * open the first time it is shown, folded on every visit after. `open` forces it
 * open while something inside is waiting (a mood change not yet asked for).
 * `preview` is for a value that is the opening of what's inside ("Why this
 * recording · Boulez makes every layer…"): shown while folded, gone once open,
 * so the same words are never read twice in a row.
 */
export function Twisty({ label, value, open, readOnce, preview, className, children }: {
  label: ReactNode
  /** What's inside, in a few words: shown beside the label while folded and open. */
  value?: ReactNode
  open?: boolean
  /** A stable key for this piece of writing ("background:<programme id>"). */
  readOnce?: string
  /** The value is the first words of the body: hidden while open. */
  preview?: boolean
  className?: string
  children: ReactNode
}) {
  // Read once: open now if never shown before, and remember it was.
  const [firstTime] = useState(() => (readOnce ? !readJson<boolean>(READ_PREFIX + readOnce, false) : false))
  useEffect(() => {
    if (readOnce && firstTime) writeJson(READ_PREFIX + readOnce, true)
  }, [readOnce, firstTime])
  return (
    <details className={[s.twisty, preview ? s.twistyPreview : '', className ?? ''].filter(Boolean).join(' ')} open={open || firstTime || undefined}>
      <summary>
        <span className={s.twistyLabel}>{label}</span>
        {value != null && value !== '' && <span className={s.twistyValue}>{value}</span>}
      </summary>
      <div className={s.twistyBody}>{children}</div>
    </details>
  )
}
