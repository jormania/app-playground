import { useState } from 'react'
import {
  getToken, setToken, clearToken,
  getDatabaseId, setDatabaseId, hasCustomDatabase,
  getWeekStart, setWeekStart, testConnection,
} from './store.js'
import { CloseIcon } from './icons.jsx'

// Connects the app to a real journal and holds the app's few preferences. The two
// BYO pieces (token + database) are stored locally, never on a server, so any user
// can point at their own copy. A "Test connection" button verifies them before you
// commit, and a week-start option tunes the calendar.
export default function SettingsModal({ onClose, onChanged }) {
  const [token, setTokenValue] = useState(getToken())
  const [db, setDb] = useState(hasCustomDatabase() ? getDatabaseId() : '')
  const [weekStart, setWeek] = useState(getWeekStart())
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState(null) // { ok, message }
  const live = Boolean(getToken())

  function save() {
    setToken(token)
    setDatabaseId(db)            // empty -> falls back to the built-in default
    setWeekStart(weekStart)
    onChanged()
    onClose()
  }
  function disconnect() {
    clearToken()
    setTokenValue('')
    onChanged()
    onClose()
  }

  async function test() {
    setTesting(true)
    setResult(null)
    try {
      const { hasEntries } = await testConnection(token, db)
      setResult({ ok: true, message: hasEntries ? 'Connected — your journal is reachable and has entries.' : 'Connected — reachable, but the database is empty so far.' })
    } catch (err) {
      setResult({ ok: false, message: err.message || 'Could not reach Notion. Check the token and that the database is shared with the integration.' })
    } finally {
      setTesting(false)
    }
  }

  const labelStyle = { fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--muted)', marginBottom: 6, display: 'block' }

  return (
    <div className="modal-scrim" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Settings</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><CloseIcon /></button>
        </div>

        <p className={`status ${live ? 'live' : 'demo'}`}>
          {live ? '● Connected — reading and writing your real journal.' : '○ Demo mode — sample delights stored only on this device.'}
        </p>

        <p>
          Paste a Notion <b>internal integration token</b> and the <b>database</b> it’s shared with.
          Both are kept only in this browser and relayed to Notion through this site’s proxy —
          never stored on a server. New here? The <a className="link" href="/journal-of-delights-guide.html" target="_blank" rel="noopener">guide</a> walks
          through building your own in a few minutes.
        </p>

        <div className="field" style={{ marginTop: 8 }}>
          <label htmlFor="s-token" style={labelStyle}>Integration token</label>
          <input id="s-token" type="password" value={token} placeholder="ntn_…"
            onChange={e => { setTokenValue(e.target.value); setResult(null) }} autoComplete="off" spellCheck="false" />
        </div>

        <div className="field">
          <label htmlFor="s-db" style={labelStyle}>Your database URL or ID</label>
          <input id="s-db" type="text" value={db} placeholder="paste the database link from Notion"
            onChange={e => { setDb(e.target.value); setResult(null) }} autoComplete="off" spellCheck="false" />
          <span className="hint" style={{ display: 'block', marginTop: 6 }}>
            Leave blank to use the app’s built-in demo database. Use your own to keep a private journal.
          </span>
        </div>

        <div className="btn-row" style={{ marginTop: 0, marginBottom: 4 }}>
          <button className="btn" onClick={test} disabled={!token.trim() || testing}>
            {testing ? 'Testing…' : 'Test connection'}
          </button>
        </div>
        {result && (
          <p className={`status ${result.ok ? 'live' : ''}`} style={{ color: result.ok ? 'var(--green)' : 'var(--red)', marginTop: 0 }}>
            {result.ok ? '✓ ' : '✕ '}{result.message}
          </p>
        )}

        <div className="field" style={{ marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 18 }}>
          <label htmlFor="s-week" style={labelStyle}>Calendar starts week on</label>
          <select id="s-week" value={weekStart} onChange={e => setWeek(Number(e.target.value))}
            style={{ width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--ink)', fontFamily: 'var(--sans)', fontSize: 15, padding: '11px 14px', outline: 'none' }}>
            <option value={1}>Monday</option>
            <option value={0}>Sunday</option>
          </select>
        </div>

        <div className="btn-row" style={{ marginTop: 18 }}>
          <button className="btn primary" onClick={save} disabled={!token.trim()}>Save</button>
          {live && <button className="btn-ghost" onClick={disconnect}>Disconnect (back to demo)</button>}
        </div>
      </div>
    </div>
  )
}
