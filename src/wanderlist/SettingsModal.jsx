import { useState, useEffect } from 'react'
import {
  getToken, setToken, clearToken,
  getDatabaseId, setDatabaseId, hasCustomDatabase,
  testConnection, PRESETS,
} from './store.js'
import { loadServerPrefs, saveServerPrefs, getLocalPrefs, sendTestReminder } from './remindersConfig.js'
import Modal from './Modal.jsx'
import { CheckIcon } from './icons.jsx'

// The palette picker — the six presets grouped dark / light, each a live swatch (canvas +
// accent + ink dots). Mirrors Sol Odyssey's Settings → Appearance; the header ◐ button still
// cycles, this just lets you jump straight to one. The swatch hexes come from PRESETS (a
// colour preview OF each palette — the one place raw hex is legitimate outside the theme
// blocks, same exception Sol Odyssey makes).
function ThemePicker({ preset, onSetPreset }) {
  return (
    <div className="theme-picker">
      {['dark', 'light'].map(mode => (
        <div key={mode} className="theme-group">
          <p className="theme-group-label">{mode}</p>
          <div className="theme-grid">
            {PRESETS.filter(p => p.mode === mode).map(p => {
              const selected = p.id === preset
              const [canvas, accent, ink] = p.swatch
              return (
                <button key={p.id} type="button" className={`theme-option${selected ? ' selected' : ''}`}
                  aria-pressed={selected} onClick={() => onSetPreset(p.id)}>
                  <span className="theme-swatch" aria-hidden style={{ background: canvas }}>
                    <span style={{ background: accent }} />
                    <span style={{ background: ink }} />
                  </span>
                  <span className="theme-name">{p.name}</span>
                  {selected && <CheckIcon />}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// Connects the app to a real backlog and configures the email reminder. Token + database
// are BYO and stored only in this browser (relayed to Notion through the proxy). The
// reminder prefs, by contrast, are saved server-side (Vercel KV) so the daily cron can
// read them with the app closed — see remindersConfig.js.
export default function SettingsModal({ preset, onSetPreset, onClose, onChanged }) {
  const [token, setTokenValue] = useState(getToken())
  const [db, setDb] = useState(hasCustomDatabase() ? getDatabaseId() : '')
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState(null) // { ok, message }
  const live = Boolean(getToken())

  // Reminders
  const localPrefs = getLocalPrefs()
  const [remOn, setRemOn] = useState(localPrefs.enabled)
  const [email, setEmail] = useState(localPrefs.email)
  const [name, setName] = useState(localPrefs.name)
  const [remStatus, setRemStatus] = useState(live ? 'loading' : 'offline') // loading|configured|unconfigured|error|offline|saved
  const [remMsg, setRemMsg] = useState('')
  const [remSaving, setRemSaving] = useState(false)
  const [testSending, setTestSending] = useState(false)
  const [testMsg, setTestMsg] = useState(null) // { ok, message } | null

  useEffect(() => {
    let cancelled = false
    if (!live) return
    loadServerPrefs().then(res => {
      if (cancelled) return
      if (res.configured) {
        setRemStatus('configured')
        if (res.prefs) { setRemOn(res.prefs.enabled); setEmail(res.prefs.email); setName(res.prefs.name) }
      } else if (res.error) {
        setRemStatus('error'); setRemMsg(res.error)
      } else {
        setRemStatus('unconfigured'); setRemMsg(res.message || '')
      }
    })
    return () => { cancelled = true }
  }, [live])

  async function saveReminders() {
    setRemSaving(true)
    setRemMsg('')
    const res = await saveServerPrefs({ enabled: remOn, email: email.trim(), name: name.trim() })
    setRemSaving(false)
    if (res.ok) { setRemStatus('saved'); setRemMsg('Saved — your reminder is set.') }
    else if (res.configured === false) { setRemStatus('unconfigured'); setRemMsg(res.message || '') }
    else { setRemStatus('error'); setRemMsg(res.error || 'Could not save.') }
  }

  async function testReminder() {
    setTestSending(true)
    setTestMsg(null)
    const res = await sendTestReminder()
    setTestSending(false)
    setTestMsg(res)
  }

  function save() {
    setToken(token)
    setDatabaseId(db)
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
      setResult({ ok: true, message: hasEntries ? 'Connected — your list is reachable and has items.' : 'Connected — reachable, but the database is empty so far.' })
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
        {live ? '● Connected — reading and writing your real list.' : '○ Demo mode — sample items stored only on this device.'}
      </p>

      <p>
        Paste a Notion <b>internal integration token</b> and the <b>database</b> it’s shared with.
        Both are kept only in this browser and relayed to Notion through this site’s proxy — never stored on a server.
        The <a className="link" href="/wanderlist-guide.html" target="_blank" rel="noopener">guide</a> walks through the whole setup.
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
          Leave blank to use the app’s built-in default database.
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

      {/* ── Email reminder ── */}
      <div className="field" style={{ marginTop: 22 }}>
        <label style={labelStyle}>Email reminder</label>
        <p style={{ marginTop: 0, marginBottom: 10 }}>
          One email around <b>7pm the evening before</b> — for anything unattended that's
          <b> Expiring</b>, <b>Planned</b>, or <b>Going</b> the next day, each labelled with
          which it is. Sent server-side, so it reaches you even with the app closed.
        </p>

        {!live && <p className="hint">Connect Notion above to set up reminders.</p>}

        {live && (
          <>
            <label className="check-row" style={{ marginBottom: 12 }}>
              <input type="checkbox" checked={remOn} onChange={e => setRemOn(e.target.checked)} />
              <span>Email me the evening before things are due</span>
            </label>
            <div className="field">
              <label htmlFor="r-email" style={labelStyle}>Send to</label>
              <input id="r-email" type="email" value={email} placeholder="you@example.com"
                onChange={e => setEmail(e.target.value)} autoComplete="off" />
            </div>
            <div className="field">
              <label htmlFor="r-name" style={labelStyle}>Your name <span className="opt">— for the greeting</span></label>
              <input id="r-name" type="text" value={name} placeholder="optional"
                onChange={e => setName(e.target.value)} autoComplete="off" />
            </div>
            <div className="btn-row" style={{ marginTop: 4 }}>
              <button className="btn" onClick={saveReminders} disabled={remSaving || remStatus === 'loading' || remStatus === 'unconfigured'}>
                {remSaving ? 'Saving…' : 'Save reminder'}
              </button>
              <button className="btn" onClick={testReminder} disabled={testSending || !email.trim() || remStatus === 'loading' || remStatus === 'unconfigured'}
                title="Sends a real email right now, so you can confirm the pipeline works">
                {testSending ? 'Sending…' : 'Send test reminder'}
              </button>
            </div>
            {testMsg && (
              <p className="hint" style={{ marginTop: 6, color: testMsg.ok ? 'var(--green)' : 'var(--red)' }}>{testMsg.message}</p>
            )}
            {remStatus === 'loading' && <p className="hint" style={{ marginTop: 6 }}>Checking reminder setup…</p>}
            {remStatus === 'unconfigured' && (
              <p className="hint" style={{ marginTop: 6, color: 'var(--gold-soft)' }}>
                {remMsg || 'Reminders need a one-time server setup.'} See the <a className="link" href="/wanderlist-guide.html" target="_blank" rel="noopener">guide</a>.
              </p>
            )}
            {remStatus === 'saved' && <p className="hint" style={{ marginTop: 6, color: 'var(--green)' }}>{remMsg}</p>}
            {remStatus === 'error' && <p className="hint" style={{ marginTop: 6, color: 'var(--red)' }}>{remMsg}</p>}
          </>
        )}
      </div>

      {/* ── Appearance ── */}
      <div className="field" style={{ marginTop: 22 }}>
        <label style={labelStyle}>Appearance</label>
        <p style={{ marginTop: 0, marginBottom: 10 }}>
          Pick a palette — three dark, three light. The header <b>◐</b> button cycles through
          them in order, and the guide follows your choice.
        </p>
        <ThemePicker preset={preset} onSetPreset={onSetPreset} />
      </div>

      <div className="btn-row" style={{ marginTop: 18 }}>
        <button className="btn primary" onClick={save} disabled={!token.trim()}>Save</button>
        {live && <button className="btn-ghost" onClick={disconnect}>Disconnect (back to demo)</button>}
      </div>
    </Modal>
  )
}
