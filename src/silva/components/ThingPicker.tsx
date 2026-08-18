import type { Thing } from '../lib/notion'
import styles from './ThingPicker.module.css'

export interface ThingPickerProps {
  things: Thing[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
}

/** A checklist of Kept things — reused by both coining a clearing and
 *  adding to an existing one (Silva's Clearings view). */
export function ThingPicker({ things, selectedIds, onToggle }: ThingPickerProps) {
  if (things.length === 0) {
    return <p className={styles.empty}>Nothing to pick from here.</p>
  }

  return (
    <ul className={styles.list}>
      {things.map((thing) => (
        <li key={thing.id} className={styles.row}>
          <label className={styles.choice}>
            <input
              type="checkbox"
              checked={selectedIds.has(thing.id)}
              onChange={() => onToggle(thing.id)}
            />
            {thing.body.length > 90 ? `${thing.body.slice(0, 90)}…` : thing.body}
          </label>
        </li>
      ))}
    </ul>
  )
}
