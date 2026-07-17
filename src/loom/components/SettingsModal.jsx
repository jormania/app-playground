import { useState } from 'react'
import { Modal } from '../../ds/components/Modal'
import { Field } from '../../ds/components/Field'
import { Button } from '../../ds/components/Button'
import { getToken, getDatabaseId, setToken, setDatabaseId, clearToken, testConnection } from '../lib/store.js'
import styles from './SettingsModal.module.css'

// "The Guild" — where you bind Loom to your own Notion database (BYO token), or
// stay in the offline demo. Deliberately tiny schema, documented right here.
export default function SettingsModal({ open, onClose, onSaved, mode }) {
  const [token, setTok] = useState(getToken())
  const [db, setDb] = useState(getDatabaseId())
  const [probe, setProbe] = useState({ state: 'idle', msg: '' })
  const [busy, setBusy] = useState(false)

  async function test() {
    setProbe({ state: 'testing', msg: '' })
    try {
      const r = await testConnection(token, db)
      setProbe({ state: 'ok', msg: r.hasEntries ? 'Connected — threads found.' : 'Connected — the database is empty.' })
    } catch (err) {
      setProbe({ state: 'err', msg: err?.message || 'Could not reach that database.' })
    }
  }

  function save() {
    setBusy(true)
    setToken(token)
    setDatabaseId(db)
    setBusy(false)
    onSaved()
    onClose()
  }

  function disconnect() {
    clearToken()
    setTok('')
    setProbe({ state: 'idle', msg: '' })
    onSaved()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="The Guild">
      <div className={styles.body}>
        <p className={styles.intro}>
          Loom keeps your week on the loom locally by default. Bind it to your own Notion
          database and every thread is backed up there — the single source of truth.
        </p>

        <Field
          label="Notion integration token"
          type="password"
          placeholder="secret_…"
          value={token}
          onChange={e => setTok(e.target.value)}
          hint="Create an internal integration at notion.so/my-integrations, then share your database with it."
        />
        <Field
          label="Database link or id"
          placeholder="https://notion.so/…  or  32-character id"
          value={db}
          onChange={e => setDb(e.target.value)}
        />

        {probe.state !== 'idle' && (
          <p className={`${styles.probe} ${styles[probe.state]}`}>
            {probe.state === 'testing' ? 'Reaching the loom…' : probe.msg}
          </p>
        )}

        <div className={styles.actions}>
          <Button variant="secondary" onClick={test} disabled={!token || !db || probe.state === 'testing'}>
            Test connection
          </Button>
          <Button variant="primary" onClick={save} disabled={busy || !token || !db}>
            Weave live
          </Button>
        </div>

        {mode === 'live' && (
          <button type="button" className={styles.disconnect} onClick={disconnect}>
            Disconnect — return to the demo loom
          </button>
        )}

        <details className={styles.schema}>
          <summary>The database schema</summary>
          <p>Give your Notion database these five properties (names are exact):</p>
          <ul>
            <li><code>Name</code> — title (the thread)</li>
            <li><code>Skein</code> — select (its project / category)</li>
            <li><code>Day</code> — date (the day it's warped to; empty = backlog)</li>
            <li><code>Order</code> — number (its manual rank; drives the heat)</li>
            <li><code>Done</code> — checkbox (woven)</li>
          </ul>
        </details>

        <p className={styles.tribute}>
          For Bobbin, and for the Guild of Weavers. ✧
        </p>
      </div>
    </Modal>
  )
}
