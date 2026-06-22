import { useState } from 'react'
import { useWorld } from './world.jsx'

const THRESHOLD_OPTIONS = [
  ['almanac', 'Living World'],
  ['tonight', "Tonight's Sky"],
  ['arc', 'Sun & Moon'],
]

export default function SettingsPanel({ currentKey, onSave, soundOn, onToggleSound, signsOn, onToggleSigns, motionOn, onToggleMotion, callOn, onToggleCall, thresholdMode, onThreshold, onClose }) {
  const [draft, setDraft] = useState(currentKey)
  const hasKey = !!currentKey
  const hasDraft = draft.trim().length > 0
  const { locationEnabled, toggleLocation } = useWorld()
  const callBlocked = callOn && typeof Notification !== 'undefined' && Notification.permission === 'denied'

  function handleSubmit(e) {
    e.preventDefault()
    onSave(draft.trim())
  }

  return (
    <div className="tg-settings">
      <h1>Tend the rite.</h1>

      <div className="tg-row tg-toggles">
        <button type="button" className="tg-toggle" aria-pressed={soundOn} onClick={onToggleSound}>{soundOn ? '♪ Sound on' : '♪ Sound off'}</button>
        <button type="button" className="tg-toggle" aria-pressed={signsOn} onClick={onToggleSigns}>{signsOn ? '✦ Signs on' : '✦ Signs off'}</button>
        <button type="button" className="tg-toggle" aria-pressed={locationEnabled} onClick={toggleLocation}>{locationEnabled ? '⌖ Place on' : '⌖ Place off'}</button>
        <button type="button" className="tg-toggle" aria-pressed={motionOn} onClick={onToggleMotion}>{motionOn ? '⟳ Motion on' : '⟳ Motion off'}</button>
        <button type="button" className="tg-toggle" aria-pressed={callOn} onClick={onToggleCall}>{callOn ? '✉ Notifications on' : '✉ Notifications off'}</button>
      </div>
      {callBlocked && <p className="tg-hint">✉ Your browser is blocking notifications — they can't reach you.</p>}

      <div className="tg-select-row">
        <label htmlFor="threshold-fill">Display the</label>
        <select id="threshold-fill" className="tg-select" value={thresholdMode} onChange={e => onThreshold(e.target.value)}>
          {THRESHOLD_OPTIONS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="tg-key-row">
          <label htmlFor="apikey">API key</label>
          <input
            id="apikey"
            type="password"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="sk-ant-..."
            autoComplete="off"
            spellCheck="false"
          />
        </div>
        <p className="tg-hint">{hasDraft
          ? '● Key set — the oracle answers.'
          : '○ Leave it empty and finds rise from the old book.'}</p>
        <div className="tg-row">
          <button type="submit">Save</button>
          {hasKey && <button type="button" onClick={() => onSave('')}>Clear</button>}
          <button type="button" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  )
}
