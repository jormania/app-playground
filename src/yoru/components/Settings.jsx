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

const MOON_PATH_OPTIONS = [
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
]

const STAR_REVEAL_OPTIONS = [
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
]

const PALETTE_OPTIONS = [
  { value: 'storm', label: 'Night' },
  { value: 'moonlight', label: 'Moonlight' },
  { value: 'candlelight', label: 'Candlelight' },
]

// A handful of your OWN blends, saved from the mixer — kept small on purpose:
// this is a phone screen, and more than a row or two of chips here would
// crowd out everything else. Names are capped at two words so a chip never
// grows wider than "Rain"/"Waves" do.
const MAX_CUSTOM_MIXES = 4
const MAX_MIX_NAME_LEN = 18

// The full settings sheet — reached only by tapping 夜, so the home stays bare.
// A dark, frameless overlay (not a card). Audio fine-tuning lives one step
// deeper, in the Mixer. Settings owns the single live sound preview, so both the
// scene here and every mixer control are auditioned by ear before a session.
export default function Settings({ settings, onChange, onClose }) {
  const [mixerOpen, setMixerOpen] = useState(false)
  const [addingMix, setAddingMix] = useState(false)
  const [mixName, setMixName] = useState('')

  const scene = settings.scene ?? 'rain'
  const mixKey = JSON.stringify(settings.mix)
  const customMixes = settings.customMixes ?? []
  // The orb is only visible when the screen stays lit.
  const screenShowsOrb = (settings.screen ?? 'lit') === 'lit'
  // The moon path only exists on the night sky, i.e. "Go dark".
  const screenShowsSky = (settings.screen ?? 'lit') === 'dark'

  const preview = useRef(null)
  const restart = useRef(0)
  // Tracks whether THIS render's scene differs from the last one previewed —
  // the one reliable signal that settings.mix just changed because of a
  // discrete preset pick (a scene chip or a saved mix, both of which also set
  // `scene`) rather than a hand-dragged mixer slider (which never touches
  // `scene` at all).
  const prevSceneRef = useRef(scene)
  useEffect(() => {
    const sceneChanged = prevSceneRef.current !== scene
    prevSceneRef.current = scene
    // Debounced so dragging a mixer slider doesn't thrash the audio graph.
    clearTimeout(restart.current)
    restart.current = setTimeout(() => {
      const outgoing = preview.current
      const s = createNightSoundscape()
      preview.current = s
      if (sceneChanged) {
        // A real crossfade for a discrete preset switch: the new blend fades
        // in while the old one overlaps and fades out with it.
        s.start({ totalSec: 100000, elapsedSec: 0, mix: settings.mix, fadeIn: 1.4 })
        outgoing?.stop(1.4)
      } else {
        // A SHORT release here, not the crossfade above: this fires on every
        // mixer tweak, and an overlapping fade meant the outgoing and
        // incoming mixes played on top of each other for up to ~1.4s after
        // every single change — exactly while you're trying to judge the
        // change by ear.
        outgoing?.stop(0.15)
        s.start({ totalSec: 100000, elapsedSec: 0, mix: settings.mix, fadeIn: 0.6 })
      }
    }, 140)
    return () => clearTimeout(restart.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mixKey])

  // Stop the preview for good when the sheet closes — also short, so it
  // doesn't linger once you're already looking at Home again.
  useEffect(() => () => preview.current?.stop(0.3), [])

  const applyCustomMix = (m) => onChange({ mix: { ...m.mix }, scene: 'custom' })
  const deleteCustomMix = (id) => onChange({ customMixes: customMixes.filter((m) => m.id !== id) })
  const saveCustomMix = () => {
    const name = mixName.trim().split(/\s+/).slice(0, 2).join(' ').slice(0, MAX_MIX_NAME_LEN)
    if (!name) return
    const entry = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, name, mix: { ...settings.mix } }
    onChange({ customMixes: [...customMixes, entry] })
    setMixName('')
    setAddingMix(false)
  }

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

        {/* Your own saved blends — a handful of chips under the presets, plus
            a "+ save" chip while there's room. Tap a chip to load it (the
            preview above crossfades into it, same as a scene pick); its "×"
            deletes it. */}
        <div className={styles.row}>
          <span className={styles.label}>your mixes</span>
          <div className={styles.mixChips}>
            {customMixes.map((m) => (
              <span key={m.id} className={styles.mixChip}>
                <button type="button" onClick={() => applyCustomMix(m)}>
                  {m.name}
                </button>
                <button type="button" aria-label={`delete ${m.name}`} onClick={() => deleteCustomMix(m.id)}>
                  ×
                </button>
              </span>
            ))}
            {customMixes.length < MAX_CUSTOM_MIXES && !addingMix && (
              <button type="button" className={styles.mixAdd} onClick={() => setAddingMix(true)}>
                + save
              </button>
            )}
          </div>
          {addingMix && (
            <div className={styles.mixEditor}>
              <input
                autoFocus
                type="text"
                className={styles.mixNameInput}
                value={mixName}
                maxLength={MAX_MIX_NAME_LEN}
                placeholder="name (2 words)"
                onChange={(e) => setMixName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveCustomMix()
                  if (e.key === 'Escape') {
                    setAddingMix(false)
                    setMixName('')
                  }
                }}
              />
              <button type="button" className={styles.mixSave} onClick={saveCustomMix}>
                save
              </button>
              <button
                type="button"
                className={styles.mixCancel}
                onClick={() => {
                  setAddingMix(false)
                  setMixName('')
                }}
              >
                cancel
              </button>
            </div>
          )}
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

        {/* Only matters once the sky is actually on screen. */}
        {screenShowsSky && (
          <div className={styles.row}>
            <span className={styles.label}>moon path</span>
            <SegmentedControl
              options={MOON_PATH_OPTIONS}
              value={settings.moonPath === false ? 'off' : 'on'}
              onChange={(v) => onChange({ moonPath: v === 'on' })}
            />
          </div>
        )}

        {/* Also only meaningful on the night sky: the first-minute "settle"
            where the stars open a little brighter, then quiet down. */}
        {screenShowsSky && (
          <div className={styles.row}>
            <span className={styles.label}>star settle</span>
            <SegmentedControl
              options={STAR_REVEAL_OPTIONS}
              value={settings.starReveal === false ? 'off' : 'on'}
              onChange={(v) => onChange({ starReveal: v === 'on' })}
            />
          </div>
        )}

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
