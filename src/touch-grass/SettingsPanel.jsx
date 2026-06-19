import { useState } from 'react'

export default function SettingsPanel({ currentKey, onSave, onClose }) {
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
        <p>Stays in your browser only. Sent directly to Anthropic each time you return from a walk. Leave it empty and finds come from a built-in list instead.</p>
        <button type="submit">Save</button>
        {hasKey && <button type="button" onClick={() => onSave('')}>Clear key</button>}
        <button type="button" onClick={onClose}>Cancel</button>
      </form>
    </div>
  )
}
