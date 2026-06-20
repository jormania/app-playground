import { useState } from 'react'
import { useWorld } from './world.jsx'

export default function SettingsPanel({ currentKey, onSave, soundOn, onToggleSound, signsOn, onToggleSigns, motionOn, onToggleMotion, callOn, onToggleCall, onClose }) {
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
      <h1>Settings</h1>

      <div className="tg-row tg-toggles">
        <button type="button" className="tg-toggle" aria-pressed={soundOn} onClick={onToggleSound}>{soundOn ? '♪ Sound on' : '♪ Sound off'}</button>
        <button type="button" className="tg-toggle" aria-pressed={signsOn} onClick={onToggleSigns}>{signsOn ? '✦ Signs on' : '✦ Signs off'}</button>
        <button type="button" className="tg-toggle" aria-pressed={locationEnabled} onClick={toggleLocation}>{locationEnabled ? '⌖ Place on' : '⌖ Place off'}</button>
        <button type="button" className="tg-toggle" aria-pressed={motionOn} onClick={onToggleMotion}>{motionOn ? '⟳ Motion on' : '⟳ Motion off'}</button>
        <button type="button" className="tg-toggle" aria-pressed={callOn} onClick={onToggleCall}>{callOn ? '✉ Daily call on' : '✉ Daily call off'}</button>
      </div>
      {callBlocked && <p className="tg-hint">✉ Your browser is blocking notifications — the daily call can't reach you.</p>}

      <form onSubmit={handleSubmit}>
        <label htmlFor="apikey">Anthropic API key</label>
        <input
          id="apikey"
          type="password"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          placeholder="sk-ant-..."
          autoComplete="off"
          spellCheck="false"
        />
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
