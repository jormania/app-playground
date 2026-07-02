import { Modal } from '../../ds'
import styles from './Player.module.css'

export function SettingsModal({ open, onClose, preferences, onChange }) {
  return (
    <Modal open={open} onClose={onClose} title="Settings">
      <label className={styles.settingsRow}>
        <input
          type="checkbox"
          checked={preferences.sound}
          onChange={(e) => onChange({ sound: e.target.checked })}
        />
        Sound cues
      </label>
      <label className={styles.settingsRow}>
        <input
          type="checkbox"
          checked={preferences.wakeLock}
          onChange={(e) => onChange({ wakeLock: e.target.checked })}
        />
        Keep screen awake
      </label>
    </Modal>
  )
}
