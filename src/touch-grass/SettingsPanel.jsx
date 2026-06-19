import { useState } from 'react'

export default function SettingsPanel({ currentKey, onSave, soundOn, onToggleSound, signsOn, onToggleSigns, onClose }) {
  const [draft, setDraft] = useState(currentKey)
  const hasKey = !!currentKey

  function handleSubmit(e) {
    e.preventDefault()
    onSave(draft.trim())
  }

  return (
    <div className="tg-settings">
      <h1>Settings</h1>
      <p>{hasKey ? '● Key saved — AI finds on.' : '○ No key — built-in finds.'}</p>

      <div className="tg-row">
        <button type="button" onClick={onToggleSound}>{soundOn ? '♪ Sound on' : '♪ Sound off'}</button>
        <button type="button" onClick={onToggleSigns}>{signsOn ? '✦ Signs on' : '✦ Signs off'}</button>
      </div>

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
        <p className="tg-hint">Empty = finds from a built-in list.</p>
        <div className="tg-row">
          <button type="submit">Save</button>
          {hasKey && <button type="button" onClick={() => onSave('')}>Clear</button>}
          <button type="button" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </div>
  )
}
