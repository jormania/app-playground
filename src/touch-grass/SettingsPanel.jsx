import { useState } from 'react'
import { useWorld } from './world.jsx'
import { gatherDiagnostics } from '../shared/notify/diagnostics'
import { useDiagnosticsReveal } from '../shared/notify/useDiagnosticsReveal'

const DIAG_KEYS = ['callEnabled', 'coords', 'lastWalkDay', 'lastCallDay', 'lastGoldenDay', 'lastAlmanacDay', 'almanacBody']

const THRESHOLD_OPTIONS = [
  ['almanac', 'Living World'],
  ['tonight', "Tonight's Sky"],
  ['arc', 'Sun & Moon'],
]

// signsOn / onToggleSigns are kept-for-later props (still passed by the parent);
// they drive the hidden "Signs" toggle commented out below, so they read as
// unused today.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function SettingsPanel({ currentKey, onSave, soundOn, onToggleSound, signsOn, onToggleSigns, motionOn, onToggleMotion, callOn, onToggleCall, thresholdMode, onThreshold, onOpenMixer, onClose }) {
  const [draft, setDraft] = useState(currentKey)
  const hasKey = !!currentKey
  const hasDraft = draft.trim().length > 0
  const { locationEnabled, toggleLocation } = useWorld()
  const callBlocked = callOn && typeof Notification !== 'undefined' && Notification.permission === 'denied'

  // Undocumented: seven quick taps on the key hint below dumps the notification
  // scheduling state (permission, periodic sync registration, last-sent days) —
  // a way to see why the daily/golden call went quiet without a laptop + devtools.
  const [diag, setDiag] = useState(null)

  const handleHintTap = useDiagnosticsReveal(async () => {
    setDiag(await gatherDiagnostics({ dbName: 'tg-call', keys: DIAG_KEYS }))
  })

  function handleSubmit(e) {
    e.preventDefault()
    onSave(draft.trim())
  }

  return (
    <div className="tg-settings">
      <div className="tg-row tg-toggles">
        <button type="button" className="tg-toggle" aria-pressed={soundOn} onClick={onToggleSound}>{soundOn ? '♪ Sound on' : '♪ Sound off'}</button>
        {/* Signs toggle hidden for now (kept for later, still drives the card via signsOn):
        <button type="button" className="tg-toggle" aria-pressed={signsOn} onClick={onToggleSigns}>{signsOn ? '✦ Signs on' : '✦ Signs off'}</button> */}
        <button type="button" className="tg-toggle" aria-pressed={locationEnabled} onClick={toggleLocation}>{locationEnabled ? '⌖ Place on' : '⌖ Place off'}</button>
        <button type="button" className="tg-toggle" aria-pressed={motionOn} onClick={onToggleMotion}>{motionOn ? '⟳ Motion on' : '⟳ Motion off'}</button>
        <button type="button" className="tg-toggle" aria-pressed={callOn} onClick={onToggleCall}>{callOn ? '✉ Pings on' : '✉ Pings off'}</button>
      </div>
      {callBlocked && <p className="tg-hint">✉ Your browser is blocking notifications — they can't reach you.</p>}

      <div className="tg-row">
        <button type="button" onClick={onOpenMixer}>♫ Tune the Chorus →</button>
      </div>

      <div className="tg-select-row">
        <label htmlFor="threshold-fill">Display the</label>
        <select id="threshold-fill" className="tg-select" value={thresholdMode} onChange={e => onThreshold(e.target.value)}>
          {THRESHOLD_OPTIONS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="tg-key-row">
          <label htmlFor="apikey">API key</label>
          <input
            id="apikey"
            type="password"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="sk-ant-..."
            autoComplete="off"
            spellCheck="false"
          />
        </div>
        <p className="tg-hint" onClick={handleHintTap}>{hasDraft
          ? '● Key set — the oracle answers.'
          : '○ Leave it empty and finds rise from the old book.'}</p>
        <div className="tg-row">
          <button type="submit">Save</button>
          {hasKey && <button type="button" onClick={() => onSave('')}>Clear</button>}
          <button type="button" onClick={onClose}>Cancel</button>
        </div>
      </form>
      {diag && (
        <div className="tg-diag">
          <p>permission: {diag.permission}</p>
          <p>periodicSync: {diag.periodicSyncTags.length ? diag.periodicSyncTags.join(', ') : 'not registered'}</p>
          <p>callEnabled: {String(!!diag.values.callEnabled)}</p>
          <p>coords: {diag.values.coords ? `${diag.values.coords.lat.toFixed(2)}, ${diag.values.coords.lon.toFixed(2)}` : 'none'}</p>
          <p>lastWalkDay: {diag.values.lastWalkDay || '—'}</p>
          <p>lastCallDay: {diag.values.lastCallDay || '—'}</p>
          <p>lastGoldenDay: {diag.values.lastGoldenDay || '—'}</p>
          <p>lastAlmanacDay: {diag.values.lastAlmanacDay || '—'}</p>
          <p>almanacBody: {diag.values.almanacBody ? 'set' : 'none'}</p>
        </div>
      )}
    </div>
  )
}
