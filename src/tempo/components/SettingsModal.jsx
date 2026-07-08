import { Modal, SegmentedControl, Button } from '../../ds'
import { useTheme } from '../lib/themeContext'
import { cueSet, playChime, playTick } from '../lib/sound'
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

const TICK_WINDOW_OPTIONS = [
  { value: '3', label: '3s' },
  { value: '5', label: '5s' },
  { value: '8', label: '8s' },
]

export function SettingsModal({ open, onClose, preferences, onChange, cueKind = 'ding', chimeMode = null }) {
  const { resolved, setTheme } = useTheme()

  // Silent mode is a master override: it mutes all audio without touching the
  // stored Sound cues preference, so switching it back off restores whatever
  // was set before. Vibration is a separate channel and is never affected —
  // Silent only ever means "no sound".
  const audioDisabled = preferences.silent
  const cueControlsDisabled = audioDisabled || !preferences.sound

  return (
    <Modal open={open} onClose={onClose} title="Settings">
      <div className={styles.settingsGroup}>
        <div>
          <p className={styles.settingsLabel}>Theme</p>
          <SegmentedControl size="sm" options={THEME_OPTIONS} value={resolved} onChange={setTheme} />
        </div>

        <div>
          <label className={styles.settingsRow}>
            <input
              type="checkbox"
              checked={preferences.silent}
              onChange={(e) => onChange({ silent: e.target.checked })}
            />
            Silent mode
          </label>
          <p className={styles.settingsHint}>Mutes all sound below. Vibration keeps working.</p>
        </div>

        <label className={`${styles.settingsRow} ${audioDisabled ? styles.settingsRowDisabled : ''}`}>
          <input
            type="checkbox"
            checked={preferences.sound}
            disabled={audioDisabled}
            onChange={(e) => onChange({ sound: e.target.checked })}
          />
          Sound cues
        </label>

        <div className={cueControlsDisabled ? styles.settingsRowDisabled : ''}>
          <p className={styles.settingsLabel}>Cue volume</p>
          <SegmentedControl
            size="sm"
            disabled={cueControlsDisabled}
            options={VOLUME_OPTIONS}
            value={preferences.volume}
            onChange={(v) => onChange({ volume: v })}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={styles.previewButton}
            disabled={cueControlsDisabled}
            onClick={() => cueSet(cueKind, preferences.volume).transition()}
          >
            ▶ Preview
          </Button>
        </div>

        <div>
          <p className={styles.settingsLabel}>Heads-up tick</p>
          <SegmentedControl
            size="sm"
            options={TICK_WINDOW_OPTIONS}
            value={String(preferences.tickWindow)}
            onChange={(v) => onChange({ tickWindow: Number(v) })}
          />
          {cueKind === 'ding' ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={styles.previewButton}
              disabled={cueControlsDisabled}
              onClick={() => playTick(preferences.volume)}
            >
              ▶ Preview
            </Button>
          ) : null}
          <p className={`${styles.settingsHint} ${styles.settingsHintFlush}`}>
            A quiet tick, ring glow, and (with Vibration on) a light pulse before a step ends, on movement, focus,
            and custom timers — not the breathing bells.
          </p>
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
          <label className={`${styles.settingsRow} ${cueControlsDisabled ? styles.settingsRowDisabled : ''}`}>
            <input
              type="checkbox"
              checked={preferences.intervalChime}
              disabled={cueControlsDisabled}
              onChange={(e) => onChange({ intervalChime: e.target.checked })}
            />
            Interval chime
          </label>
          {preferences.intervalChime && (
            <div className={styles.subControl}>
              <SegmentedControl
                size="sm"
                disabled={cueControlsDisabled}
                options={CHIME_OPTIONS}
                value={String(preferences.chimeInterval)}
                onChange={(v) => onChange({ chimeInterval: Number(v) })}
              />
              {chimeMode ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className={styles.previewButton}
                  disabled={cueControlsDisabled}
                  onClick={() => playChime(preferences.volume, chimeMode)}
                >
                  ▶ Preview
                </Button>
              ) : null}
            </div>
          )}
          <p className={`${styles.settingsHint} ${styles.settingsHintFlush}`}>
            Only on Sit–Walk (a distinct bell) and Custom (a soft alarm) — the long-session modes.
          </p>
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
