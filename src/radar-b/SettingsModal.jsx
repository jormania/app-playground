import { useState } from 'react'
import { Modal, Button } from '../ds'
import { getToken, setToken, clearToken, radarDb, findingsDb, suggestedPage, testConnection } from './store.js'

/**
 * Settings, in four named sections rather than one undifferentiated list.
 *
 * The ordering is deliberate: what you'll actually revisit sits at the top
 * (what's allowed into the stream), the one-time plumbing sits below it, and
 * appearance and help are last. Previously every field — token, three database
 * ids, and the theme picker — sat in a flat column with no headings, which made
 * the gear read as a theme control (see the icon note in icons.jsx).
 */

/** A labelled switch row. Kept local rather than pulled from ds/ because the
 *  "what this is hiding right now" count underneath is specific to this screen. */
function Toggle({ label, hint, count, checked, onChange }) {
  return (
    <label className="toggleRow">
      <span className="toggleText">
        <span className="toggleLabel">{label}</span>
        <span className="hint">
          {hint}
          {count > 0 && <> · <strong>{count}</strong> ascunse acum</>}
        </span>
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

export function SettingsModal({ onClose, onSaved, theme, onTheme, intake, onIntake, hiddenCounts = {} }) {
  const [token, setTokenValue] = useState(getToken())
  const [radar, setRadar] = useState(radarDb.get())
  const [findings, setFindings] = useState(findingsDb.get())
  const [suggested, setSuggested] = useState(suggestedPage.get())
  const [status, setStatus] = useState(null)
  const [testing, setTesting] = useState(false)

  const setIntake = (patch) => onIntake({ ...intake, ...patch })

  async function test() {
    setTesting(true)
    setStatus(null)
    try {
      await testConnection(token, radar, findings)
      setStatus({ ok: true, message: 'Conexiune reușită.' })
    } catch (err) {
      setStatus({ ok: false, message: err.message })
    } finally {
      setTesting(false)
    }
  }

  function save() {
    const trimmed = token.trim()
    if (trimmed) setToken(trimmed)
    else clearToken()
    radarDb.set(radar)
    findingsDb.set(findings)
    suggestedPage.set(suggested)
    onSaved()
  }

  return (
    <Modal open onClose={onClose} title="Setări">
      {/* ── 1. What gets in ─────────────────────────────────────────────── */}
      <h3 className="settingsSection">Ce intră în Radar</h3>
      <p className="settingsIntro">
        Radar-B citește și Wanderlist, care e mai larg decât „ce se întâmplă săptămâna asta".
        Toate filtrele sunt pornite implicit — stinge unul și evenimentele revin.
      </p>

      <Toggle
        label="Ascunde ce am bifat ca Attended"
        hint="Ai fost deja — nu mai e ceva la care să mergi"
        count={hiddenCounts.hideAttended}
        checked={intake.hideAttended}
        onChange={(v) => setIntake({ hideAttended: v })}
      />
      <Toggle
        label="Ascunde Ideas"
        hint={'F\u0103r\u0103 dat\u0103 planificat\u0103 \u0219i f\u0103r\u0103 termen \u2014 un \u201ec\u00e2ndva\u201d, nu un eveniment'}
        count={hiddenCounts.hideIdeas}
        checked={intake.hideIdeas}
        onChange={(v) => setIntake({ hideIdeas: v })}
      />
      <Toggle
        label="Ascunde locuri și descoperiri"
        hint="Categoriile venue, idea și discovery — locuri și piste, nu evenimente cu oră"
        count={hiddenCounts.hideNonEvents}
        checked={intake.hideNonEvents}
        onChange={(v) => setIntake({ hideNonEvents: v })}
      />
      <Toggle
        label="Ascunde ce am ascuns eu"
        hint="Se sincronizează prin Notion, deci e la fel pe telefon și pe laptop"
        count={hiddenCounts.hideDismissed}
        checked={intake.hideDismissed}
        onChange={(v) => setIntake({ hideDismissed: v })}
      />

      {/* ── 2. Connection ───────────────────────────────────────────────── */}
      <h3 className="settingsSection">Conexiune Notion</h3>

      <label className="field">
        <span>Token</span>
        <input type="password" value={token} onChange={(e) => setTokenValue(e.target.value)} placeholder="ntn_…" autoComplete="off" />
        <span className="hint">Rămâne doar în acest browser. Gol = mod demo, pe date de exemplu.</span>
      </label>

      <label className="field">
        <span>Baza Radar</span>
        <input value={radar} onChange={(e) => setRadar(e.target.value)} placeholder="Link sau ID Notion" />
        <span className="hint">Evenimentele scrise de <code>/recommend in Bucharest</code>.</span>
      </label>

      <label className="field">
        <span>Baza Findings (Wanderlist)</span>
        <input value={findings} onChange={(e) => setFindings(e.target.value)} />
        <span className="hint">Unde se salvează și de unde se citește starea (Going, dată planificată).</span>
      </label>

      <label className="field">
        <span>Pagina „Suggested events"</span>
        <input value={suggested} onChange={(e) => setSuggested(e.target.value)} />
        <span className="hint">Citită doar pentru lista de articole din care s-a construit săptămâna.</span>
      </label>

      {status && <p className={`notice${status.ok ? '' : ' warn'}`}>{status.message}</p>}

      {/* ── 3. Appearance ───────────────────────────────────────────────── */}
      <h3 className="settingsSection">Aspect</h3>
      <label className="field">
        <span>Temă</span>
        <select value={theme} onChange={(e) => onTheme(e.target.value)}>
          <option value="system">ca sistemul</option>
          <option value="light">luminos</option>
          <option value="dark">întunecat</option>
        </select>
      </label>

      {/* ── 4. Help ─────────────────────────────────────────────────────── */}
      <h3 className="settingsSection">Ajutor</h3>
      <p className="provenanceNote" style={{ marginTop: 0 }}>
        Ghidul complet — cum funcționează <code>/recommend in Bucharest</code>, dedublarea,
        provenance-ul și legătura cu Wanderlist —{' '}
        <a href="/radar-b-guide.html" target="_blank" rel="noopener">e aici</a>.
      </p>

      <div className="actions">
        <Button variant="ghost" onClick={test} disabled={testing || !token.trim()}>
          {testing ? 'Se testează…' : 'Testează'}
        </Button>
        <Button onClick={save}>Salvează</Button>
      </div>
    </Modal>
  )
}
