import { useState } from 'react'
import {
  getToken, setToken, clearToken,
  getDatabaseId, setDatabaseId, hasCustomDatabase,
  testConnection,
  getRemindersEnabled, setRemindersEnabled,
  getRemindersNudge, setRemindersNudge,
  getRemindersOnThisDay, setRemindersOnThisDay,
} from './store.js'
import { enableReminders, unregisterPeriodicSync, capabilities, notificationPermission, REMINDERS_DB } from './reminders.js'
import { gatherDiagnostics } from '../shared/notify/diagnostics'
import { useDiagnosticsReveal } from '../shared/notify/useDiagnosticsReveal'
import Modal from './Modal.jsx'

const DIAG_KEYS = ['state', 'lastNudgeSent', 'lastOnThisDaySent']

// Connects the app to a real journal. The two BYO pieces (token + database) are
// stored locally, never on a server, so any user can point at their own copy.
// "Test connection" verifies them before you commit.
export default function SettingsModal({ onClose, onChanged }) {
  const [token, setTokenValue] = useState(getToken())
  const [db, setDb] = useState(hasCustomDatabase() ? getDatabaseId() : '')
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState(null) // { ok, message }
  const live = Boolean(getToken())

  const [remindersOn, setRemindersOn] = useState(getRemindersEnabled())
  const [nudgeOn, setNudgeOn] = useState(getRemindersNudge())
  const [onThisDayOn, setOnThisDayOn] = useState(getRemindersOnThisDay())
  const [reminderMsg, setReminderMsg] = useState('')
  const [diag, setDiag] = useState(null)
  const caps = capabilities()
  const remindersBlocked = remindersOn && notificationPermission() === 'denied'

  // Undocumented: seven quick taps on the reminders hint below dumps the background
  // notification state — the same diagnostics trick Touch Grass and Sol Odyssey use, since
  // this relies on the exact same fragile mechanism (a service worker woken in the background).
  const handleHintTap = useDiagnosticsReveal(async () => {
    setDiag(await gatherDiagnostics({ dbName: REMINDERS_DB, keys: DIAG_KEYS }))
  })

  async function toggleReminders() {
    if (remindersOn) {
      setRemindersEnabled(false)
      setRemindersOn(false)
      setReminderMsg('')
      void unregisterPeriodicSync()
      return
    }
    setRemindersEnabled(true)
    setRemindersOn(true)
    const permission = await enableReminders()
    if (permission !== 'granted') {
      setRemindersEnabled(false)
      setRemindersOn(false)
      setReminderMsg('Notifications are blocked in your browser — allow them to use reminders.')
    } else if (!caps.periodicSync) {
      setReminderMsg('Background reminders aren’t supported on this browser/device — they’ll only show while the app happens to be open.')
    } else {
      setReminderMsg('')
    }
  }
  function toggleNudge() {
    const next = !nudgeOn
    setRemindersNudge(next)
    setNudgeOn(next)
  }
  function toggleOnThisDay() {
    const next = !onThisDayOn
    setRemindersOnThisDay(next)
    setOnThisDayOn(next)
  }

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

        <div className="field" style={{ marginTop: 22 }}>
          <label style={labelStyle}>Gentle reminders</label>
          <p className="hint" style={{ marginBottom: 8 }}>
            A 9pm nudge to write today’s delight if it isn’t written yet, and a 7pm note when
            past years share this calendar day (nothing shows when there’s no match). Local and
            best-effort — nothing is sent on your behalf.
          </p>
          <div className="btn-row" style={{ marginTop: 0 }}>
            <button type="button" className="btn" aria-pressed={remindersOn} onClick={toggleReminders}>
              {remindersOn ? '✉ Reminders on' : '✉ Reminders off'}
            </button>
            {remindersOn && (
              <>
                <button type="button" className="btn btn-sm" aria-pressed={nudgeOn} onClick={toggleNudge}>
                  {nudgeOn ? 'Evening nudge on' : 'Evening nudge off'}
                </button>
                <button type="button" className="btn btn-sm" aria-pressed={onThisDayOn} onClick={toggleOnThisDay}>
                  {onThisDayOn ? 'On this day on' : 'On this day off'}
                </button>
              </>
            )}
          </div>
          {remindersBlocked && (
            <p className="hint" style={{ color: 'var(--red)', marginTop: 8 }}>
              Your browser is blocking notifications — they can’t reach you.
            </p>
          )}
          {reminderMsg && <p className="hint" style={{ marginTop: 8 }}>{reminderMsg}</p>}
          <p className="hint" onClick={handleHintTap} style={{ marginTop: 10 }}>Local · best-effort · Chromium + installed app only</p>
          {diag && (
            <div className="jod-diag">
              <p>permission: {diag.permission}</p>
              <p>periodicSync: {diag.periodicSyncTags.length ? diag.periodicSyncTags.join(', ') : 'not registered'}</p>
              <p>state: {diag.values.state ? JSON.stringify(diag.values.state) : 'none'}</p>
              <p>lastNudgeSent: {diag.values.lastNudgeSent || '—'}</p>
              <p>lastOnThisDaySent: {diag.values.lastOnThisDaySent || '—'}</p>
            </div>
          )}
        </div>

        <div className="btn-row" style={{ marginTop: 18 }}>
          <button className="btn primary" onClick={save} disabled={!token.trim()}>Save</button>
          {live && <button className="btn-ghost" onClick={disconnect}>Disconnect (back to demo)</button>}
        </div>
    </Modal>
  )
}
