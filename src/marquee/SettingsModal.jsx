import { useEffect, useState } from 'react'
import { Button, Field, Modal, SegmentedControl, SettingsToggle } from '../ds'
import { getToken, setToken, clearToken, venuesDb, findingsDb, isLive, clientFor } from './store.js'
import { parseNotionId } from '../shared/notionId'
import { VENUES_DATABASE_ID } from './notionClient.js'
import { getAdapter } from './adapters.js'
import { isActive } from './venues.js'
import { formatDay } from './format.js'

/** One venue's own row in the health list: what's reading it, whether it's
 *  paused, and what its last check actually found — the three things "is
 *  this venue okay?" needs, all of which already live on the Notion row but
 *  nowhere in the app puts them side by side. */
function VenueHealthRow({ venue }) {
  const adapter = getAdapter(venue.adapter)
  const active = isActive(venue)
  return (
    <li className={`health__row ${active ? '' : 'health__row--paused'}`}>
      <div className="health__name">
        {venue.name}
        {!active && <span className="chip chip--paused">paused</span>}
      </div>
      <p className="health__meta">
        {adapter ? adapter.label : 'no reader'}
        {venue.lastChecked ? ` · checked ${formatDay(venue.lastChecked, { relative: true })}` : ' · never checked'}
      </p>
      {venue.lastResult && <p className="health__result">{venue.lastResult}</p>}
    </li>
  )
}

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
export default function SettingsModal({ open, prefs, onPrefs, counts = {}, venues = [], onClose, onChanged }) {
  const [token, setTokenValue] = useState('')
  const [db, setDb] = useState('')
  const [findings, setFindings] = useState('')
  const [testing, setTesting] = useState(false)
  const [probe, setProbe] = useState(null)
  const [status, setStatus] = useState(null)

  useEffect(() => {
    if (!open) return
    setTokenValue(getToken())
    setDb(venuesDb.get())
    setFindings(findingsDb.get())
    setProbe(null)
    setStatus(null)
  }, [open])

  const set = (patch) => onPrefs({ ...prefs, ...patch })

  /** An id that can't be parsed is REFUSED here rather than quietly dropped.
   *  `idSetting.set` clears the stored value on an unparseable input, so the app
   *  silently fell back to its built-in default — pasting the wrong thing looked
   *  exactly like pasting the right thing, and the only symptom was Marquee
   *  reading a database you hadn't chosen. */
  function saveConnection() {
    const bad = []
    if (db.trim() && !parseNotionId(db)) bad.push('Watched Venues')
    if (findings.trim() && !parseNotionId(findings)) bad.push('Wanderlist Findings')
    if (bad.length) {
      setStatus(`${bad.join(' and ')} ${bad.length === 1 ? 'is not' : 'are not'} a Notion database URL or id — nothing was saved.`)
      return
    }
    setToken(token)
    if (db.trim()) venuesDb.set(db)
    if (findings.trim()) findingsDb.set(findings)
    onChanged()
    onClose()
  }

  function disconnect() {
    clearToken()
    onChanged()
    onClose()
  }

  async function test() {
    setTesting(true)
    setStatus(null)
    setProbe(null)
    try {
      // The credentials on screen, not the ones already stored — see clientFor.
      setProbe(await clientFor(token, db, findings).probe())
    } catch (err) {
      setStatus(err?.message || 'Could not reach Notion.')
    } finally {
      setTesting(false)
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
          <SettingsToggle
            label="Hide what’s already in Wanderlist"
            hint={counts.kept ? `${counts.kept} fully kept` : 'Runs where every date is already saved'}
            checked={prefs.hideKept}
            onChange={(e) => set({ hideKept: e.target.checked })}
          />
        </section>

        <section>
          <h3 className="settings__head">Venue health</h3>
          {venues.length === 0 ? (
            <p className="settings__hint">No venues yet — add one from the Venues tab.</p>
          ) : (
            <ul className="health">
              {[...venues].sort((a, b) => a.name.localeCompare(b.name, 'ro')).map((v) => (
                <VenueHealthRow key={v.id ?? v.name} venue={v} />
              ))}
            </ul>
          )}
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
          <Field
            label="Wanderlist Findings database"
            value={findings}
            onChange={(e) => setFindings(e.target.value)}
            hint="Where keeping writes, and what dedupe reads. Your integration needs access to this one too."
          />

          {probe && (
            <div className="probe">
              <p className={probe.venues.ok ? 'warn' : 'warn warn--stop'}>
                <strong>Venues:</strong>{' '}
                {probe.venues.ok
                  ? probe.venues.hasRows ? 'reachable.' : 'reachable, but empty.'
                  : probe.venues.error}
              </p>
              <p className={probe.findings.ok ? 'warn' : 'warn warn--stop'}>
                <strong>Findings:</strong>{' '}
                {probe.findings.ok
                  ? probe.findings.hasRows ? 'reachable.' : 'reachable, but empty.'
                  : probe.findings.error}
              </p>
              {!probe.findings.ok && (
                <p className="settings__hint">
                  Share this database with your integration in Notion — see the guide below.
                </p>
              )}
            </div>
          )}
          {status && <p className="warn warn--stop" role="alert">{status}</p>}

          <div className="settings__row">
            {isLive() && <Button variant="secondary" size="sm" onClick={disconnect}>Disconnect</Button>}
            <Button variant="secondary" size="sm" onClick={test} disabled={testing}>
              {testing ? 'Testing…' : 'Test connection'}
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
