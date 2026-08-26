import { useEffect, useState } from 'react'
import { Button, Field, Modal, SegmentedControl, SettingsToggle } from '../ds'
import { getToken, setToken, clearToken, venuesDb, isLive, getClient } from './store.js'
import { VENUES_DATABASE_ID } from './notionClient.js'

const THEMES = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

/**
 * Everything that isn't a venue or a showing.
 *
 * Ordered by how often you'd actually come here: appearance and the view toggles
 * first because they are the ones you revisit, the Notion plumbing below them
 * because it is set once, and help last.
 */
export default function SettingsModal({ open, prefs, onPrefs, counts = {}, onClose, onChanged }) {
  const [token, setTokenValue] = useState('')
  const [db, setDb] = useState('')
  const [status, setStatus] = useState(null)

  useEffect(() => {
    if (!open) return
    setTokenValue(getToken())
    setDb(venuesDb.get())
    setStatus(null)
  }, [open])

  const set = (patch) => onPrefs({ ...prefs, ...patch })

  function saveConnection() {
    setToken(token)
    if (db.trim()) venuesDb.set(db)
    onChanged()
    onClose()
  }

  function disconnect() {
    clearToken()
    onChanged()
    onClose()
  }

  async function test() {
    setStatus('testing')
    try {
      const probe = await getClient().probe()
      setStatus(probe.hasRows ? 'ok' : 'empty')
    } catch (err) {
      setStatus(err?.message || 'Could not reach Notion.')
    }
  }

  return (
    <Modal open={open} title="Settings" onClose={onClose}>
      <div className="settings">
        <section>
          <h3 className="settings__head">Appearance</h3>
          <p className="settings__label" id="marquee-theme-label">Theme</p>
          <SegmentedControl options={THEMES} value={prefs.theme} onChange={(theme) => set({ theme })} />
          <p className="settings__hint">
            <strong>System</strong> follows your device, and keeps following it when it changes.
          </p>
        </section>

        <section>
          <h3 className="settings__head">Programme</h3>
          <SettingsToggle
            label="Hide sold-out productions"
            hint={counts.soldOut ? `${counts.soldOut} currently sold out` : 'Runs with no ticket left anywhere'}
            checked={prefs.hideSoldOut}
            onChange={(e) => set({ hideSoldOut: e.target.checked })}
          />
          <SettingsToggle
            label="Show what you’ve ignored"
            hint={counts.ignored ? `${counts.ignored} ignored` : 'Bring ignored productions back into the list so you can un-ignore them'}
            checked={prefs.showIgnored}
            onChange={(e) => set({ showIgnored: e.target.checked })}
          />
          <SettingsToggle
            label="Keep the day’s showings after they start"
            hint="Off by default — a 19:00 concert stops being useful at 19:30"
            checked={prefs.keepToday}
            onChange={(e) => set({ keepToday: e.target.checked })}
          />
        </section>

        <section>
          <h3 className="settings__head">Notion</h3>
          <Field
            label="Integration token"
            type="password"
            value={token}
            onChange={(e) => setTokenValue(e.target.value)}
            hint="Stored in this browser only. Leave empty to stay in demo mode."
          />
          <Field
            label="Watched Venues database"
            value={db}
            onChange={(e) => setDb(e.target.value)}
            hint={`URL or id. Defaults to ${VENUES_DATABASE_ID.slice(0, 8)}… — “Marquee — Watched Venues”.`}
          />
          {status === 'ok' && <p className="warn">Connected — the database answered.</p>}
          {status === 'empty' && <p className="warn">Connected, but the database has no rows yet.</p>}
          {status && !['ok', 'empty', 'testing'].includes(status) && (
            <p className="warn warn--stop" role="alert">{status}</p>
          )}
          <div className="settings__row">
            {isLive() && <Button variant="secondary" size="sm" onClick={disconnect}>Disconnect</Button>}
            <Button variant="secondary" size="sm" onClick={test} disabled={status === 'testing'}>
              {status === 'testing' ? 'Testing…' : 'Test connection'}
            </Button>
            <Button size="sm" onClick={saveConnection}>Save</Button>
          </div>
        </section>

        <section>
          <h3 className="settings__head">Help</h3>
          <p className="settings__hint">
            <a href="/marquee-guide.html" target="_blank" rel="noreferrer noopener">
              Read the guide
            </a>{' '}
            — what a check does, how to read “what changed”, and what each failure means.
          </p>
        </section>
      </div>
    </Modal>
  )
}
