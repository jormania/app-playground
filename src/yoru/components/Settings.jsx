import { useEffect, useRef, useState } from 'react'
import { SegmentedControl } from '../../ds'
import { createNightSoundscape } from '../lib/soundscape'
import { SCENE_PRESETS } from '../lib/storage'
import Mixer from './Mixer'
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

// Chime has no chip here on purpose — it's an accent meant to sit over one of
// these, not a scene of its own (see storage.js). Dial it in from the mixer.
const SCENE_OPTIONS = [
  { value: 'rain', label: 'Rain' },
  { value: 'waves', label: 'Waves' },
  { value: 'stream', label: 'Stream' },
  { value: 'wind', label: 'Wind' },
  { value: 'forest', label: 'Forest' },
]

const HAPTICS_OPTIONS = [
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
]

const SCREEN_OPTIONS = [
  { value: 'lit', label: 'Stay lit' },
  { value: 'dark', label: 'Go dark' },
  { value: 'off', label: 'Turn off' },
]

const PALETTE_OPTIONS = [
  { value: 'storm', label: 'Night' },
  { value: 'moonlight', label: 'Moonlight' },
  { value: 'candlelight', label: 'Candlelight' },
]

// The full settings sheet — reached only by tapping 夜, so the home stays bare.
// A dark, frameless overlay (not a card). Audio fine-tuning lives one step
// deeper, in the Mixer. Settings owns the single live sound preview, so both the
// scene here and every mixer control are auditioned by ear before a session.
export default function Settings({ settings, onChange, onClose }) {
  const [mixerOpen, setMixerOpen] = useState(false)

  const scene = settings.scene ?? 'rain'
  const mixKey = JSON.stringify(settings.mix)
  // The orb is only visible when the screen stays lit.
  const screenShowsOrb = (settings.screen ?? 'lit') === 'lit'

  const preview = useRef(null)
  const restart = useRef(0)
  useEffect(() => {
    // Debounced so dragging a mixer slider doesn't thrash the audio graph.
    clearTimeout(restart.current)
    restart.current = setTimeout(() => {
      preview.current?.stop()
      const s = createNightSoundscape()
      preview.current = s
      s.start({ totalSec: 100000, elapsedSec: 0, mix: settings.mix, fadeIn: 0.6 })
    }, 140)
    return () => clearTimeout(restart.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mixKey])

  // Stop the preview for good when the sheet closes.
  useEffect(() => () => preview.current?.stop(), [])

  return (
    <div className={styles.overlay} role="dialog" aria-label="Settings">
      <button type="button" className={styles.close} lang="ja" aria-label="Close settings" onClick={onClose}>
        夜
      </button>

      <div className={styles.list}>
        <label className={styles.row}>
          <span className={styles.label}>your name</span>
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
          <span className={styles.label}>session length</span>
          <SegmentedControl
            size="sm"
            options={LENGTH_OPTIONS}
            value={String(settings.minutes)}
            onChange={(v) => onChange({ minutes: parseInt(v, 10) })}
          />
        </div>

        <div className={styles.row}>
          <span className={styles.label}>soundscape</span>
          <SegmentedControl
            size="sm"
            options={SCENE_OPTIONS}
            value={scene}
            onChange={(v) => onChange({ scene: v, mix: { ...settings.mix, ...SCENE_PRESETS[v] } })}
          />
        </div>

        <div className={styles.row}>
          <span className={styles.label}>audio tuner</span>
          <button type="button" className={styles.mixerBtn} onClick={() => setMixerOpen(true)}>
            open mixer →
          </button>
        </div>

        <div className={styles.row}>
          <span className={styles.label}>display mode</span>
          <SegmentedControl options={SCREEN_OPTIONS} value={settings.screen ?? 'lit'} onChange={(v) => onChange({ screen: v })} />
        </div>

        <div className={styles.row}>
          <span className={styles.label}>atmosphere</span>
          <SegmentedControl options={PALETTE_OPTIONS} value={settings.palette ?? 'storm'} onChange={(v) => onChange({ palette: v })} />
        </div>

        {/* With the screen dark or off you can't see the orb, so breathwork —
            and its pattern — don't apply and are hidden. */}
        {screenShowsOrb && (
          <div className={styles.row}>
            <span className={styles.label}>breathwork</span>
            <SegmentedControl
              options={BREATHWORK_OPTIONS}
              value={settings.breathwork === false ? 'off' : 'on'}
              onChange={(v) => onChange({ breathwork: v === 'on' })}
            />
          </div>
        )}

        {screenShowsOrb && settings.breathwork !== false && (
          <div className={styles.row}>
            <span className={styles.label}>pattern</span>
            <SegmentedControl options={BREATH_OPTIONS} value={settings.breath} onChange={(v) => onChange({ breath: v })} />
          </div>
        )}

        {screenShowsOrb && settings.breathwork !== false && (
          <div className={styles.row}>
            <span className={styles.label}>haptics</span>
            <SegmentedControl
              options={HAPTICS_OPTIONS}
              value={settings.haptics ? 'on' : 'off'}
              onChange={(v) => onChange({ haptics: v === 'on' })}
            />
          </div>
        )}
      </div>

      <button type="button" className={styles.done} onClick={onClose}>
        done
      </button>

      {mixerOpen && <Mixer settings={settings} onChange={onChange} onClose={() => setMixerOpen(false)} />}
    </div>
  )
}
