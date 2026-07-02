import { Modal, SegmentedControl } from '../../ds'
import { useTheme } from '../lib/themeContext'
import styles from './Player.module.css'

const THEME_OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

const VOLUME_OPTIONS = [
  { value: 'soft', label: 'Soft' },
  { value: 'normal', label: 'Normal' },
  { value: 'loud', label: 'Loud' },
]

const CHIME_OPTIONS = [
  { value: '3', label: '3 min' },
  { value: '5', label: '5 min' },
  { value: '10', label: '10 min' },
]

export function SettingsModal({ open, onClose, preferences, onChange }) {
  const { resolved, setTheme } = useTheme()

  return (
    <Modal open={open} onClose={onClose} title="Settings">
      <div className={styles.settingsGroup}>
        <div>
          <p className={styles.settingsLabel}>Theme</p>
          <SegmentedControl size="sm" options={THEME_OPTIONS} value={resolved} onChange={setTheme} />
        </div>

        <label className={styles.settingsRow}>
          <input type="checkbox" checked={preferences.sound} onChange={(e) => onChange({ sound: e.target.checked })} />
          Sound cues
        </label>

        <div>
          <p className={styles.settingsLabel}>Cue volume</p>
          <SegmentedControl
            size="sm"
            options={VOLUME_OPTIONS}
            value={preferences.volume}
            onChange={(v) => onChange({ volume: v })}
          />
        </div>

        <label className={styles.settingsRow}>
          <input
            type="checkbox"
            checked={preferences.prepare}
            onChange={(e) => onChange({ prepare: e.target.checked })}
          />
          Count-in (3·2·1)
        </label>

        <div>
          <label className={styles.settingsRow}>
            <input
              type="checkbox"
              checked={preferences.intervalChime}
              onChange={(e) => onChange({ intervalChime: e.target.checked })}
            />
            Interval chime
          </label>
          {preferences.intervalChime && (
            <div className={styles.subControl}>
              <SegmentedControl
                size="sm"
                options={CHIME_OPTIONS}
                value={String(preferences.chimeInterval)}
                onChange={(v) => onChange({ chimeInterval: Number(v) })}
              />
            </div>
          )}
        </div>

        <label className={styles.settingsRow}>
          <input
            type="checkbox"
            checked={preferences.haptics}
            onChange={(e) => onChange({ haptics: e.target.checked })}
          />
          Vibration (on supported phones)
        </label>
        <label className={styles.settingsRow}>
          <input
            type="checkbox"
            checked={preferences.wakeLock}
            onChange={(e) => onChange({ wakeLock: e.target.checked })}
          />
          Keep screen awake
        </label>

        <a className={styles.guideLink} href="/tempo-guide.html" target="_blank" rel="noopener">
          Open the guide →
        </a>
      </div>
    </Modal>
  )
}
