import { useState } from 'react'
import { Modal, Button } from '../ds'
import { getToken, setToken, clearToken, radarDb, findingsDb, suggestedPage, testConnection } from './store.js'

/**
 * BYO Notion token + the three ids Radar-B reads. Same contract as Wanderlist and
 * Journal of Delights: the token lives only in this browser and is relayed
 * per-request through /api/notion, which stores nothing.
 *
 * With no token the app runs on fixtures (demo mode) — a real, browsable week, so
 * the product can be evaluated before any setup at all.
 */
export function SettingsModal({ onClose, onSaved, theme, onTheme }) {
  const [token, setTokenValue] = useState(getToken())
  const [radar, setRadar] = useState(radarDb.get())
  const [findings, setFindings] = useState(findingsDb.get())
  const [suggested, setSuggested] = useState(suggestedPage.get())
  const [status, setStatus] = useState(null)
  const [testing, setTesting] = useState(false)

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
      <label className="field">
        <span>Token Notion</span>
        <input type="password" value={token} onChange={(e) => setTokenValue(e.target.value)} placeholder="ntn_…" autoComplete="off" />
        <span className="hint">Rămâne doar în acest browser. Gol = mod demo, pe date de exemplu.</span>
      </label>

      <label className="field">
        <span>Baza Radar</span>
        <input value={radar} onChange={(e) => setRadar(e.target.value)} placeholder="Link sau ID Notion" />
        <span className="hint">Evenimentele normalizate scrise de <code>/recommend in Bucharest</code>. Fără ea, Radar-B arată doar ce e deja în Wanderlist.</span>
      </label>

      <label className="field">
        <span>Baza Findings (Wanderlist)</span>
        <input value={findings} onChange={(e) => setFindings(e.target.value)} />
        <span className="hint">Unde se salvează. Aceeași bază pe care o folosește Wanderlist.</span>
      </label>

      <label className="field">
        <span>Pagina „Suggested events"</span>
        <input value={suggested} onChange={(e) => setSuggested(e.target.value)} />
        <span className="hint">Citită doar pentru a arăta din ce articole s-a construit săptămâna curentă.</span>
      </label>

      <label className="field">
        <span>Temă</span>
        <select value={theme} onChange={(e) => onTheme(e.target.value)}>
          <option value="system">ca sistemul</option>
          <option value="light">luminos</option>
          <option value="dark">întunecat</option>
        </select>
      </label>

      {status && <p className={`notice${status.ok ? '' : ' warn'}`}>{status.message}</p>}

      <div className="actions">
        <Button variant="ghost" onClick={test} disabled={testing || !token.trim()}>
          {testing ? 'Se testează…' : 'Testează'}
        </Button>
        <Button onClick={save}>Salvează</Button>
      </div>
    </Modal>
  )
}
