import { useState } from 'react'
import { BIOMES } from './place.js'

// "The Chorus" — the ambient soundscape's mixer. Every slider is a multiplier
// layered OVER the already-tuned sound in ambientAudio.js, not a replacement
// for it: at the defaults (10 on every category/volume, 5 on Activity, 10 on
// Warmth, biome unset) nothing about today's mix changes at all — see the
// Chorus notes at the top of ambientAudio.js and DEFAULT_MIX in App.jsx.

const BIOME_LABELS = { coast: 'Coast', forest: 'Forest', city: 'City', mountain: 'Mountain', plain: 'Plain' }

// Natural elements + the rare surprises woven through them
const FIELD = [
  { key: 'place', label: 'Place', hint: 'surf, traffic hum, thin wind, rustle underfoot' },
  { key: 'weather', label: 'Weather', hint: 'rain, wind, thunder, the winter chime' },
  { key: 'wildlife', label: 'Wildlife', hint: 'birds, crickets, critters passing by' },
  { key: 'events', label: 'Omens', hint: 'bells, howls, meteor-shimmer — the rare surprises' },
]
// The human world — its own separate realm
const CITY = [
  { key: 'city', label: 'City', hint: 'traffic drifting past, a bike bell, planes overhead' },
]
const SHAPERS = [
  { key: 'volume', label: 'Volume', hint: 'overall loudness' },
  { key: 'activity', label: 'Activity', hint: 'how often the world speaks up' },
  { key: 'warmth', label: 'Warmth', hint: 'hushed and close, or bright and open' },
]

const MAX_CUSTOM_MIXES = 4
const MAX_MIX_NAME_LEN = 18

// a biome preset is the app's own golden-standard sound for that place — unity
// on every category/shaper, with the biome pinned so it plays regardless of
// where you actually are (see useAmbientSound's effectiveBiome)
const goldenStandard = (biome) => ({
  biome, place: 10, weather: 10, wildlife: 10, city: 10, events: 10, volume: 10, activity: 5, warmth: 10,
})

export default function MixerPanel({ mix, onChange, onReset, onClose, customMixes = [], onSaveMix, onDeleteMix }) {
  const [addingMix, setAddingMix] = useState(false)
  const [mixName, setMixName] = useState('')

  const setLevel = (key, value) => onChange({ [key]: value })
  const applyPreset = (biome) => onChange(goldenStandard(biome))
  const applyCustom = (m) => onChange({ ...m.mix })

  const submitSave = () => {
    if (!mixName.trim() || !onSaveMix) return
    onSaveMix(mixName)
    setMixName('')
    setAddingMix(false)
  }

  const renderRow = ({ key, label, hint, max = 10 }) => {
    const value = typeof mix[key] === 'number' ? mix[key] : Math.round(max / 2)
    const pct = (value / max) * 100
    return (
      <div key={key} className="tg-mixer-row">
        <span className="tg-mixer-label">
          {label}
          <span className="tg-mixer-value">{value}</span>
        </span>
        <input
          type="range"
          min={0}
          max={max}
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
      <h1>The Chorus</h1>
      <p className="tg-hint">Balance what you hear along the way.</p>
      <div className="tg-mixer-list">
        <span className="tg-mixer-group">attunements</span>
        <div className="tg-mixer-chips">
          <button type="button" className={mix.biome == null ? 'tg-chip tg-chip-active' : 'tg-chip'} onClick={() => applyPreset(null)}>
            Here
          </button>
          {BIOMES.map((b) => (
            <button key={b} type="button" className={mix.biome === b ? 'tg-chip tg-chip-active' : 'tg-chip'} onClick={() => applyPreset(b)}>
              {BIOME_LABELS[b]}
            </button>
          ))}
        </div>
        <span className="tg-mixer-note">A golden-standard blend for each place — hear it, wherever you actually are.</span>

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
        {onSaveMix && customMixes.length < MAX_CUSTOM_MIXES && !addingMix && (
          <div className="tg-mixer-chips">
            <button type="button" className="tg-chip tg-chip-dashed" onClick={() => setAddingMix(true)}>+ save this mix</button>
          </div>
        )}
        {addingMix && (
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
        )}

        <span className="tg-mixer-group">the field</span>
        {FIELD.map(renderRow)}
        <span className="tg-mixer-group">the city</span>
        {CITY.map(renderRow)}
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
