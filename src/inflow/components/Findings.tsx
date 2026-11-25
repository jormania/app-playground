/**
 * What lib/guards.ts found before a save, shown above the form's buttons:
 * one line each, a one-tap fix where there is one. Saving again unchanged
 * means "I meant it"; any edit clears them and they are checked afresh.
 */
import { AlertTriangle } from 'lucide-react'
import type { Finding, Fix } from '../lib/guards'
import styles from '../styles/ui.module.css'

export function Findings({ items, onFix }: { items: Finding[]; onFix: (f: Fix) => void }) {
  if (!items.length) return null
  return (
    <div className={styles.findings} role="alert" aria-label="Worth a second look">
      <b><AlertTriangle size={14} aria-hidden /> Worth a second look</b>
      <ul>
        {items.map((f) => (
          <li key={f.id}>
            <span>{f.text}</span>
            {f.fix && <button type="button" className={styles.chip} onClick={() => onFix(f.fix!.apply)}>{f.fix.label}</button>}
          </li>
        ))}
      </ul>
    </div>
  )
}
