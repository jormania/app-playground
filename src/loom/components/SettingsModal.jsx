import { useState } from 'react'
import { Modal } from '../../ds/components/Modal'
import { Field } from '../../ds/components/Field'
import { Button } from '../../ds/components/Button'
import {
  getToken, getDatabaseId, setToken, setDatabaseId, clearToken, hasCustomDatabase, testConnection,
} from '../lib/store.js'
import { useTheme } from '../lib/themeContext.jsx'
import { useLexicon } from '../lib/lexiconContext.jsx'
import { PRESETS } from '../lib/theme.js'
import styles from './SettingsModal.module.css'

// The Appearance picker — Loom's two SCUMM palettes as live swatches. The header
// ◐ button cycles them; this jumps straight to one. Swatch hexes come from
// PRESETS (a colour preview OF each palette — the one place raw hex is legit
// outside the theme blocks).
function ThemePicker({ current, onPick }) {
  return (
    <div className={styles.themeGrid}>
      {PRESETS.map(p => {
        const [canvas, accent, ink] = p.swatch
        const selected = p.id === current
        return (
          <button
            key={p.id}
            type="button"
            className={`${styles.themeOption} ${selected ? styles.themeSelected : ''}`}
            aria-pressed={selected}
            onClick={() => onPick(p.id)}
          >
            <span className={styles.swatch} style={{ background: canvas }} aria-hidden="true">
              <span style={{ background: accent }} />
              <span style={{ background: ink }} />
            </span>
            <span className={styles.themeName}>{p.name}{selected ? ' ✓' : ''}</span>
          </button>
        )
      })}
    </div>
  )
}

// "The Guild" — where you bind Loom to your own Notion database (BYO token), pick
// a palette, or stay in the offline demo. Deliberately tiny schema, documented in
// the guide (a duplicatable Starter Template) and summarised right here.
// The two voices, previewed as a live line so you can see what each does before
// you pick. Loom's SCUMM flavour is the default; "Plain" aliases every term to a
// common planner word without changing a thing about how the app works.
function VoicePicker({ voice, onPick }) {
  const options = [
    { id: 'loom', name: 'Loom words', hint: 'threads · skeins · weave · the distaff' },
    { id: 'plain', name: 'Plain words', hint: 'tasks · projects · complete · the backlog' },
  ]
  return (
    <div className={styles.themeGrid}>
      {options.map(o => {
        const selected = o.id === voice
        return (
          <button
            key={o.id}
            type="button"
            className={`${styles.themeOption} ${styles.voiceOption} ${selected ? styles.themeSelected : ''}`}
            aria-pressed={selected}
            onClick={() => onPick(o.id)}
          >
            <span className={styles.themeName}>{o.name}{selected ? ' ✓' : ''}</span>
            <span className={styles.voiceHint}>{o.hint}</span>
          </button>
        )
      })}
    </div>
  )
}

export default function SettingsModal({ open, onClose, onSaved, mode }) {
  const theme = useTheme()
  const lex = useLexicon()
  const [token, setTok] = useState(getToken())
  const [db, setDb] = useState(hasCustomDatabase() ? getDatabaseId() : '')
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
    <Modal open={open} onClose={onClose} title={lex.t('Guild')}>
      <div className={styles.body}>
        <p className={`${styles.status} ${mode === 'live' ? styles.live : styles.demo}`}>
          {mode === 'live'
            ? '◆ Bound to Notion — reading and writing your real threads.'
            : '◇ Demo loom — sample threads kept only on this device.'}
        </p>

        <p className={styles.intro}>
          Loom keeps your week on the loom locally by default. Bind it to your own Notion
          database and every thread is backed up there — the single source of truth. The{' '}
          <a className={styles.link} href="/loom-guide.html" target="_blank" rel="noopener">guide</a>{' '}
          walks the whole setup, including a database you can duplicate in one click.
        </p>

        <Field
          label="Notion integration token"
          type="password"
          placeholder="ntn_…"
          value={token}
          autoComplete="off"
          spellCheck={false}
          onChange={e => { setTok(e.target.value); setProbe({ state: 'idle', msg: '' }) }}
          hint="Create an internal integration at notion.so/my-integrations, then share your database with it."
        />
        <Field
          label="Database link or id"
          placeholder="paste your database link — or leave blank for the default"
          value={db}
          autoComplete="off"
          spellCheck={false}
          onChange={e => { setDb(e.target.value); setProbe({ state: 'idle', msg: '' }) }}
          hint="Leave blank to use Loom's built-in default database."
        />

        {probe.state !== 'idle' && (
          <p className={`${styles.probe} ${styles[probe.state]}`}>
            {probe.state === 'testing' ? 'Reaching the loom…' : probe.msg}
          </p>
        )}

        <div className={styles.actions}>
          <Button variant="secondary" onClick={test} disabled={!token || probe.state === 'testing'}>
            Test connection
          </Button>
          <Button variant="primary" onClick={save} disabled={busy || !token}>
            Weave live
          </Button>
        </div>

        {mode === 'live' && (
          <button type="button" className={styles.disconnect} onClick={disconnect}>
            Disconnect — return to the demo loom
          </button>
        )}

        {/* ── Appearance ── */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Appearance</h3>
          <p className={styles.sectionHint}>Two moods for the Guild — the header ◐ button cycles them, and the guide follows your choice.</p>
          <ThemePicker current={theme.themeId} onPick={theme.setTheme} />
        </div>

        {/* ── Vocabulary ── */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Vocabulary</h3>
          <p className={styles.sectionHint}>
            Loom speaks the loom-house tongue by default. Prefer plain planner words? Switch the whole
            app over — every feature works exactly the same, only the names change.
          </p>
          <VoicePicker voice={lex.voice} onPick={lex.setVoice} />
        </div>

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
          <p className={styles.schemaNote}>
            Easiest: duplicate the ready-made template from the{' '}
            <a className={styles.link} href="/loom-guide.html" target="_blank" rel="noopener">guide</a>.
          </p>
        </details>

        <p className={styles.tribute}>For Bobbin, and for the Guild of Weavers. ✧</p>
      </div>
    </Modal>
  )
}
