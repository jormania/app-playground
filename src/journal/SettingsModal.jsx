import { useState } from 'react'
import {
  getToken, setToken, clearToken,
  getDatabaseId, setDatabaseId, hasCustomDatabase,
  testConnection,
} from './store.js'
import Modal from './Modal.jsx'

// Connects the app to a real journal. The two BYO pieces (token + database) are
// stored locally, never on a server, so any user can point at their own copy.
// "Test connection" verifies them before you commit.
export default function SettingsModal({ onClose, onChanged }) {
  const [token, setTokenValue] = useState(getToken())
  const [db, setDb] = useState(hasCustomDatabase() ? getDatabaseId() : '')
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState(null) // { ok, message }
  const live = Boolean(getToken())

  function save() {
    setToken(token)
    setDatabaseId(db)            // empty -> falls back to the built-in default
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
    <Modal title="Settings" onClose={onClose}>
        <p className={`status ${live ? 'live' : 'demo'}`}>
          {live ? '● Connected — reading and writing your real journal.' : '○ Demo mode — sample delights stored only on this device.'}
        </p>

        <p>
          Paste a Notion <b>internal integration token</b> and the <b>database</b> it’s shared with.
          Both are kept only in this browser and relayed to Notion through this site’s proxy —
          never stored on a server.
        </p>
        <p>
          New here?{' '}
          <a className="link" href="https://app.notion.com/p/Journal-of-Delights-Starter-Template-390d3e6d60db811ca03ed1fa20412f78" target="_blank" rel="noopener">Duplicate the Starter Template</a>{' '}
          for a ready-made database, then paste its link below — the <a className="link" href="/journal-of-delights-guide.html" target="_blank" rel="noopener">guide</a> walks through the whole setup.
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
        <p className="status" aria-live="polite" style={{ minHeight: result ? undefined : 0, color: result ? (result.ok ? 'var(--green)' : 'var(--red)') : undefined, marginTop: 0 }}>
          {result ? `${result.ok ? '✓ ' : '✕ '}${result.message}` : ''}
        </p>

        <div className="btn-row" style={{ marginTop: 18 }}>
          <button className="btn primary" onClick={save} disabled={!token.trim()}>Save</button>
          {live && <button className="btn-ghost" onClick={disconnect}>Disconnect (back to demo)</button>}
        </div>
    </Modal>
  )
}
