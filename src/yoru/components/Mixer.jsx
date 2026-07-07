import { createPortal } from 'react-dom'
import { DEFAULT_MIX, MIX_MAX } from '../lib/storage'
import styles from './Mixer.module.css'

// The controls, grouped: blendable nature LAYERS, then global SHAPERS. Each
// carries a very discrete one-line hint — the only in-app "guide" there is.
const LAYERS = [
  { key: 'rain', label: 'Rain', hint: 'soft rain and far-off droplets' },
  { key: 'waves', label: 'Waves', hint: 'slow ocean surf, rising and receding' },
  { key: 'wind', label: 'Wind', hint: 'air moving through the dark' },
  { key: 'leaves', label: 'Leaves', hint: 'a hush of wind through the trees' },
  { key: 'warmth', label: 'Warmth', hint: 'the soft noise floor beneath it all' },
  { key: 'drone', label: 'Drone', hint: 'a deep, soft hum underneath' },
]
const SHAPERS = [
  { key: 'volume', label: 'Volume', hint: 'overall loudness — 0 is silent' },
  { key: 'brightness', label: 'Brightness', hint: 'the tone, from dark to airy' },
  { key: 'motion', label: 'Motion', hint: 'how much it swells and gusts' },
  { key: 'pace', label: 'Pace', hint: 'how fast it drifts and swells' },
]

// The audio mixer — a separate area from the rest of Settings. Ten sliders,
// each 0–10, plus a Reset to the mid default. There is no on/off: sound is the
// whole point of Yoru; the Volume dial takes it down as far as you like. What you
// hear updates live (the preview lives in Settings, which owns the sound).
export default function Mixer({ settings, onChange, onClose }) {
  const mix = settings.mix ?? DEFAULT_MIX

  const setLevel = (key, value) => onChange({ mix: { ...mix, [key]: value } })
  const reset = () => onChange({ mix: { ...DEFAULT_MIX } })

  const renderControl = ({ key, label, hint }) => {
    const value = typeof mix[key] === 'number' ? mix[key] : 5
    const pct = (value / MIX_MAX) * 100
    return (
      <label key={key} className={styles.row}>
        <span className={styles.head}>
          <span className={styles.name}>{label}</span>
          <span className={styles.level}>{value}</span>
        </span>
        <input
          className={styles.slider}
          type="range"
          min={0}
          max={MIX_MAX}
          step={1}
          value={value}
          onChange={(e) => setLevel(key, Number(e.target.value))}
          style={{ background: `linear-gradient(to right, var(--yoru-glow) ${pct}%, var(--color-surface-2) ${pct}%)` }}
          aria-label={`${label} — ${hint}`}
        />
        <span className={styles.hint}>{hint}</span>
      </label>
    )
  }

  // Portalled to <body> so the fixed overlay anchors to the viewport, not to the
  // Settings sheet (whose rise animation leaves a transform that would otherwise
  // become the containing block, letting Settings peek through).
  return createPortal(
    <div className={styles.overlay} role="dialog" aria-label="Audio mixer">
      <button type="button" className={styles.close} lang="ja" aria-label="Close mixer" onClick={onClose}>
        夜
      </button>
      <h2 className={styles.title}>mixer</h2>

      <div className={styles.list}>
        <div className={styles.sliders}>
          <span className={styles.group}>layers</span>
          {LAYERS.map(renderControl)}
          <span className={styles.group}>shapers</span>
          {SHAPERS.map(renderControl)}
        </div>
      </div>

      <div className={styles.foot}>
        <button type="button" className={styles.reset} onClick={reset}>
          reset
        </button>
        <button type="button" className={styles.done} onClick={onClose}>
          done
        </button>
      </div>
    </div>,
    document.body,
  )
}
