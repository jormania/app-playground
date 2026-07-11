import { useState } from 'react'
import { SCENE_PRESETS, PRESET_ORDER, PRESET_LABELS, activePreset } from './mix.js'

// "The Chorus" — Touch Grass's soundscape mixer. A layer-blend engine ported
// from Yoru (see ambientAudio.js): pick a soundscape, save your own blends, then
// dial the eight nature layers, the Touch Grass voices, and the global shapers.

// the seven blendable beds (Yoru's layers, minus its tonal drone)
const LAYERS = [
  { key: 'rain', label: 'Rain', hint: 'soft wash, droplets, and distant thunder' },
  { key: 'waves', label: 'Waves', hint: 'slow ocean surf, rising and receding' },
  { key: 'stream', label: 'Stream', hint: 'a steady brook, softly babbling' },
  { key: 'wind', label: 'Wind', hint: 'air moving through the open' },
  { key: 'leaves', label: 'Leaves', hint: 'a hush of wind through the trees' },
  { key: 'chime', label: 'Chime', hint: 'a wind chime, only now and then' },
  { key: 'warmth', label: 'Warmth', hint: 'a soft noise floor beneath it all' },
]
// the Touch Grass voices — one-shots over the bed
const VOICES = [
  { key: 'wildlife', label: 'Wildlife', hint: 'birds, crickets, a cat or a dog' },
  { key: 'omens', label: 'Omens', hint: 'a bell, a cuckoo, a wolf — the rare ones' },
  { key: 'activity', label: 'Activity', hint: 'how often the voices speak up' },
]
// global shapers
const SHAPERS = [
  { key: 'volume', label: 'Volume', hint: 'overall loudness' },
  { key: 'brightness', label: 'Brightness', hint: 'the tone, from dark to airy' },
  { key: 'motion', label: 'Motion', hint: 'how much it swells and gusts' },
  { key: 'pace', label: 'Pace', hint: 'how fast it drifts and swells' },
]

const MAX_CUSTOM_MIXES = 4
const MAX_MIX_NAME_LEN = 18

export default function MixerPanel({ mix, onChange, onReset, onClose, customMixes = [], onSaveMix, onDeleteMix, stereoOn = true, onToggleStereo }) {
  const [addingMix, setAddingMix] = useState(false)
  const [mixName, setMixName] = useState('')

  const setLevel = (key, value) => onChange({ [key]: value })
  const applyPreset = (key) => onChange({ ...SCENE_PRESETS[key] })
  const applyCustom = (m) => onChange({ ...m.mix })
  const active = activePreset(mix)

  const submitSave = () => {
    if (!mixName.trim() || !onSaveMix) return
    onSaveMix(mixName)
    setMixName('')
    setAddingMix(false)
  }

  const renderRow = ({ key, label, hint }) => {
    const value = typeof mix[key] === 'number' ? mix[key] : 5
    const pct = (value / 10) * 100
    return (
      <div key={key} className="tg-mixer-row">
        <span className="tg-mixer-label">
          {label}
          <span className="tg-mixer-value">{value}</span>
        </span>
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={value}
          onChange={(e) => setLevel(key, Number(e.target.value))}
          className="tg-mixer-slider"
          style={{ background: `linear-gradient(to right, #ecc356 ${pct}%, rgba(243, 234, 212, 0.18) ${pct}%)` }}
          aria-label={`${label} — ${hint}`}
        />
        <span className="tg-mixer-hint">{hint}</span>
      </div>
    )
  }

  return (
    <div className="tg-mixer">
      {onToggleStereo && (
        <div className="tg-mixer-toggles">
          <button type="button" className="tg-toggle" aria-pressed={stereoOn} onClick={onToggleStereo}>{stereoOn ? '↔ Stereo on' : '↔ Stereo off'}</button>
        </div>
      )}
      <div className="tg-mixer-list">
        <span className="tg-mixer-group">soundscapes</span>
        <div className="tg-mixer-chips">
          {PRESET_ORDER.map((key) => (
            <button
              key={key}
              type="button"
              className={active === key ? 'tg-chip tg-chip-active' : 'tg-chip'}
              onClick={() => applyPreset(key)}
            >
              {PRESET_LABELS[key]}
            </button>
          ))}
        </div>

        <span className="tg-mixer-group">your mixes</span>
        {customMixes.length > 0 && (
          <div className="tg-mixer-chips">
            {customMixes.map((m) => (
              <span key={m.id} className="tg-chip-pair">
                <button type="button" className="tg-chip" onClick={() => applyCustom(m)}>{m.name}</button>
                <button type="button" className="tg-chip-x" aria-label={`Delete ${m.name}`} onClick={() => onDeleteMix && onDeleteMix(m.id)}>×</button>
              </span>
            ))}
          </div>
        )}
        {addingMix ? (
          <div className="tg-mixer-save-row">
            <input
              autoFocus
              type="text"
              value={mixName}
              maxLength={MAX_MIX_NAME_LEN}
              placeholder="name (2 words)"
              onChange={(e) => setMixName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitSave()
                if (e.key === 'Escape') { setAddingMix(false); setMixName('') }
              }}
            />
            <button type="button" onClick={submitSave}>Save</button>
            <button type="button" onClick={() => { setAddingMix(false); setMixName('') }}>Cancel</button>
          </div>
        ) : (
          onSaveMix && customMixes.length < MAX_CUSTOM_MIXES && (
            <div className="tg-mixer-chips">
              <button type="button" className="tg-chip tg-chip-dashed" onClick={() => setAddingMix(true)}>+ save this mix</button>
            </div>
          )
        )}

        <span className="tg-mixer-group">layers</span>
        {LAYERS.map(renderRow)}
        <span className="tg-mixer-group">voices</span>
        {VOICES.map(renderRow)}
        <span className="tg-mixer-group">shapers</span>
        {SHAPERS.map(renderRow)}
      </div>
      <div className="tg-row">
        <button type="button" onClick={onReset}>Reset</button>
        <button type="button" onClick={onClose}>Done</button>
      </div>
    </div>
  )
}
