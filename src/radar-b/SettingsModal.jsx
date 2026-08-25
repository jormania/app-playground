import { useState } from 'react'
import { Modal, Button } from '../ds'
import { getToken, setToken, clearToken, radarDb, findingsDb, suggestedPage, testConnection } from './store.js'
import { useT, LANGS } from './i18n.js'

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
function Toggle({ label, hint, count, countLabel, checked, onChange }) {
  return (
    <label className="toggleRow">
      <span className="toggleText">
        <span className="toggleLabel">{label}</span>
        <span className="hint">
          {hint}
          {count > 0 && <> · {countLabel}</>}
        </span>
      </span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  )
}

export function SettingsModal({ onClose, onSaved, theme, onTheme, lang, onLang, intake, onIntake, hiddenCounts = {} }) {
  const t = useT()
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
      setStatus({ ok: true, message: t('settings.testOk') })
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
    <Modal open onClose={onClose} title={t('settings.title')}>
      {/* ── 1. What gets in ─────────────────────────────────────────────── */}
      <h3 className="settingsSection">{t('settings.intake')}</h3>
      <p className="settingsIntro">
        {t('settings.intakeIntro')}
      </p>

      <Toggle
        label={t('settings.hideAttended')}
        hint={t('settings.hideAttendedHint')}
        count={hiddenCounts.hideAttended}
        countLabel={t('settings.hiddenNow', { n: hiddenCounts.hideAttended })}
        checked={intake.hideAttended}
        onChange={(v) => setIntake({ hideAttended: v })}
      />
      <Toggle
        label={t('settings.hideIdeas')}
        hint={t('settings.hideIdeasHint')}
        count={hiddenCounts.hideIdeas}
        countLabel={t('settings.hiddenNow', { n: hiddenCounts.hideIdeas })}
        checked={intake.hideIdeas}
        onChange={(v) => setIntake({ hideIdeas: v })}
      />
      <Toggle
        label={t('settings.hideNonEvents')}
        hint={t('settings.hideNonEventsHint')}
        count={hiddenCounts.hideNonEvents}
        countLabel={t('settings.hiddenNow', { n: hiddenCounts.hideNonEvents })}
        checked={intake.hideNonEvents}
        onChange={(v) => setIntake({ hideNonEvents: v })}
      />
      <Toggle
        label={t('settings.hideDismissed')}
        hint={t('settings.hideDismissedHint')}
        count={hiddenCounts.hideDismissed}
        countLabel={t('settings.hiddenNow', { n: hiddenCounts.hideDismissed })}
        checked={intake.hideDismissed}
        onChange={(v) => setIntake({ hideDismissed: v })}
      />

      {/* ── 2. Connection ───────────────────────────────────────────────── */}
      <h3 className="settingsSection">{t('settings.connection')}</h3>

      <label className="field">
        <span>{t('settings.token')}</span>
        <input type="password" value={token} onChange={(e) => setTokenValue(e.target.value)} placeholder="ntn_…" autoComplete="off" />
        <span className="hint">{t('settings.tokenHint')}</span>
      </label>

      <label className="field">
        <span>{t('settings.radarDb')}</span>
        <input value={radar} onChange={(e) => setRadar(e.target.value)} placeholder={t('settings.idPlaceholder')} />
        <span className="hint">{t('settings.radarDbHint')}</span>
      </label>

      <label className="field">
        <span>{t('settings.findingsDb')}</span>
        <input value={findings} onChange={(e) => setFindings(e.target.value)} />
        <span className="hint">{t('settings.findingsDbHint')}</span>
      </label>

      <label className="field">
        <span>{t('settings.suggestedPage')}</span>
        <input value={suggested} onChange={(e) => setSuggested(e.target.value)} />
        <span className="hint">{t('settings.suggestedPageHint')}</span>
      </label>

      {status && <p className={`notice${status.ok ? '' : ' warn'}`}>{status.message}</p>}

      {/* ── 3. Appearance ───────────────────────────────────────────────── */}
      <h3 className="settingsSection">{t('settings.appearance')}</h3>
      <label className="field">
        <span>{t('settings.theme')}</span>
        <select value={theme} onChange={(e) => onTheme(e.target.value)}>
          <option value="system">{t('settings.themeSystem')}</option>
          <option value="light">{t('settings.themeLight')}</option>
          <option value="dark">{t('settings.themeDark')}</option>
        </select>
      </label>

      <label className="field">
        <span>{t('settings.language')}</span>
        <select value={lang} onChange={(e) => onLang(e.target.value)}>
          {LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
      </label>

      {/* ── 4. Help ───────────────────────────────────── */}
      <h3 className="settingsSection">{t('settings.help')}</h3>
      <p className="provenanceNote" style={{ marginTop: 0 }}>
        {t('settings.guideNote', { link: '' })}{' '}
        <a href="/radar-b-guide.html" target="_blank" rel="noopener">{t('settings.guideLink')}</a>.
      </p>

      <div className="actions">
        <Button variant="ghost" onClick={test} disabled={testing || !token.trim()}>
          {testing ? t('settings.testing') : t('settings.test')}
        </Button>
        <Button onClick={save}>{t('settings.save')}</Button>
      </div>
    </Modal>
  )
}
