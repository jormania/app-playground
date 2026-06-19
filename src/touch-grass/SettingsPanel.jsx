import { useState } from 'react'

export default function SettingsPanel({ currentKey, onSave, soundOn, onToggleSound, onClose }) {
  const [draft, setDraft] = useState(currentKey)
  const hasKey = !!currentKey

  function handleSubmit(e) {
    e.preventDefault()
    onSave(draft.trim())
  }

  return (
    <div>
      <h1>Settings</h1>
      <p>{hasKey ? '● Key saved — AI finds on.' : '○ No key yet — finds come from a built-in list.'}</p>

      <label>Sound</label>
      <button type="button" onClick={onToggleSound}>{soundOn ? '♪ On' : '♪ Off'}</button>
      <p>{soundOn
        ? 'Wind, water, the season\'s voices, and soft taps as you move through the app.'
        : 'The world is quiet for now.'}</p>

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
        <p>Leave it empty and finds come from a built-in list instead.</p>
        <button type="submit">Save</button>
        {hasKey && <button type="button" onClick={() => onSave('')}>Clear key</button>}
        <button type="button" onClick={onClose}>Cancel</button>
      </form>
    </div>
  )
}
