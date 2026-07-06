import { useEffect, useRef } from 'react'
import { SegmentedControl } from '../../ds'
import { createNightSoundscape } from '../lib/soundscape'
import styles from './Settings.module.css'

const LENGTH_OPTIONS = [
  { value: '15', label: "15'" },
  { value: '30', label: "30'" },
  { value: '45', label: "45'" },
  { value: '60', label: "60'" },
  { value: '90', label: "90'" },
]

const BREATHWORK_OPTIONS = [
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
]

const BREATH_OPTIONS = [
  { value: 'exhale', label: 'Lengthening exhale' },
  { value: '478', label: '4·7·8' },
]

const SCENE_OPTIONS = [
  { value: 'rain', label: 'Rain' },
  { value: 'waves', label: 'Waves' },
  { value: 'wind', label: 'Wind' },
  { value: 'forest', label: 'Forest' },
]

const INTENSITY_OPTIONS = [
  { value: 'faint', label: 'Faint' },
  { value: 'gentle', label: 'Gentle' },
  { value: 'steady', label: 'Steady' },
  { value: 'lively', label: 'Lively' },
]

const VOLUME_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'soft', label: 'Soft' },
  { value: 'medium', label: 'Medium' },
  { value: 'full', label: 'Full' },
]

const SCREEN_OPTIONS = [
  { value: 'lit', label: 'Stay lit' },
  { value: 'dark', label: 'Go dark' },
]

const PALETTE_OPTIONS = [
  { value: 'storm', label: 'Night' },
  { value: 'moonlight', label: 'Moonlight' },
]

// The full settings sheet — reached only by tapping 夜, so the home stays bare.
// A dark, frameless overlay (not a card): all of Yoru's choices in one quiet
// list, closed with a tap of 夜 at the top.
export default function Settings({ settings, onChange, onClose }) {
  // Audition the sound live while the sheet is open, so scene + volume can be
  // chosen by ear before a session ever begins. A long totalSec keeps it steady
  // (no ebb); a quick fade makes each change audible almost at once. Stops when
  // the sheet closes.
  const scene = settings.scene ?? 'rain'
  const volume = settings.volume ?? 'medium'
  const intensity = settings.intensity ?? 'gentle'
  const preview = useRef(null)
  useEffect(() => {
    const s = createNightSoundscape()
    preview.current = s
    s.start({ totalSec: 100000, elapsedSec: 0, volume, scene, intensity, fadeIn: 0.8 })
    return () => s.stop()
  }, [scene, volume, intensity])

  return (
    <div className={styles.overlay} role="dialog" aria-label="Settings">
      <button type="button" className={styles.close} lang="ja" aria-label="Close settings" onClick={onClose}>
        夜
      </button>

      <div className={styles.list}>
        <label className={styles.row}>
          <span className={styles.label}>you</span>
          <input
            className={styles.name}
            type="text"
            value={settings.name ?? ''}
            maxLength={24}
            placeholder="your name (optional)"
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </label>

        <div className={styles.row}>
          <span className={styles.label}>length</span>
          <SegmentedControl
            size="sm"
            options={LENGTH_OPTIONS}
            value={String(settings.minutes)}
            onChange={(v) => onChange({ minutes: parseInt(v, 10) })}
          />
        </div>

        <div className={styles.row}>
          <span className={styles.label}>sound</span>
          <SegmentedControl size="sm" options={SCENE_OPTIONS} value={settings.scene ?? 'rain'} onChange={(v) => onChange({ scene: v })} />
        </div>

        <div className={styles.row}>
          <span className={styles.label}>intensity</span>
          <SegmentedControl size="sm" options={INTENSITY_OPTIONS} value={settings.intensity ?? 'gentle'} onChange={(v) => onChange({ intensity: v })} />
        </div>

        <div className={styles.row}>
          <span className={styles.label}>volume</span>
          <SegmentedControl size="sm" options={VOLUME_OPTIONS} value={settings.volume ?? 'medium'} onChange={(v) => onChange({ volume: v })} />
        </div>

        <div className={styles.row}>
          <span className={styles.label}>screen</span>
          <SegmentedControl options={SCREEN_OPTIONS} value={settings.screen ?? 'lit'} onChange={(v) => onChange({ screen: v })} />
        </div>

        <div className={styles.row}>
          <span className={styles.label}>colour</span>
          <SegmentedControl options={PALETTE_OPTIONS} value={settings.palette ?? 'storm'} onChange={(v) => onChange({ palette: v })} />
        </div>

        <div className={styles.row}>
          <span className={styles.label}>breathwork</span>
          <SegmentedControl
            options={BREATHWORK_OPTIONS}
            value={settings.breathwork === false ? 'off' : 'on'}
            onChange={(v) => onChange({ breathwork: v === 'on' })}
          />
        </div>

        {settings.breathwork !== false && (
          <div className={styles.row}>
            <span className={styles.label}>pattern</span>
            <SegmentedControl options={BREATH_OPTIONS} value={settings.breath} onChange={(v) => onChange({ breath: v })} />
          </div>
        )}
      </div>

      <button type="button" className={styles.done} onClick={onClose}>
        done
      </button>
    </div>
  )
}
