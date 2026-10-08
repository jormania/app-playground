import { useRef, useState } from 'react'
import { Field, SegmentedControl } from '../../ds'
import { useServices } from '../app/services'
import { beginSignIn, redirectUriFor } from '../spotify/auth'
import { isValidTimeZone } from '../domain/week'
import type { ThemeChoice } from '../app/settings'
import s from '../styles/editorial.module.css'

export function SettingsScreen() {
  const { settings, updateSettings, status, refreshStatus, spotify, syncSpotify, repo, bump, say, notionState, syncNotion } = useServices()
  const [pass, setPass] = useState(settings.passphrase)
  const [zone, setZone] = useState(settings.timeZone)
  const [clientId, setClientId] = useState(settings.spotifyClientId)
  const fileRef = useRef<HTMLInputElement>(null)

  async function unlock() {
    updateSettings({ passphrase: pass.trim() })
    setTimeout(() => void refreshStatus(), 0)
  }

  async function connectSpotify() {
    if (!clientId.trim()) return say('Add your Spotify app’s Client ID first.', 'danger')
    updateSettings({ spotifyClientId: clientId.trim() })
    window.location.assign(await beginSignIn(clientId.trim(), redirectUriFor()))
  }

  async function exportBackup() {
    const data = await repo.exportAll()
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `the-long-listen-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function importBackup(file: File) {
    try {
      const n = await repo.importAll(JSON.parse(await file.text()))
      bump()
      say(`Restored ${n} records.`, 'success')
    } catch (e) {
      say(e instanceof Error ? e.message : 'That file couldn’t be read.', 'danger')
    }
  }

  return (
    <div>
      <p className={s.eyebrow}>Settings</p>
      <h1 className={s.titleSmall}>Settings</h1>

      <section className={s.settingsGroup}>
        <h2 className={s.h2}>The curator</h2>
        <p className={s.quiet}>The curator runs on this app’s server, which holds the Anthropic key. Your passphrase unlocks it from this device.</p>
        <Field label="Passphrase" type="password" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} />
        <div className={s.row}>
          <button className={s.textButton} onClick={unlock} disabled={pass.trim() === settings.passphrase && status !== null}>Unlock</button>
          <span className={s.faint}>
            {settings.demo ? 'Demo curator (development only).' : status ? `Connected${status.curator ? '' : ' — but the server has no Anthropic key yet'}.` : settings.passphrase ? 'Not connected — check the passphrase.' : 'Not connected.'}
          </span>
        </div>
      </section>

      <section className={s.settingsGroup}>
        <h2 className={s.h2}>Your week</h2>
        <p className={s.quiet}>Weeks run Monday to Sunday in this time zone, wherever you or the server happen to be.</p>
        <Field label="Time zone" value={zone} onChange={(e) => setZone(e.target.value)} error={zone && !isValidTimeZone(zone) ? 'Not a time zone this browser knows.' : undefined} hint="For example Europe/Bucharest" />
        <button className={s.textButton} disabled={!isValidTimeZone(zone) || zone === settings.timeZone} onClick={() => updateSettings({ timeZone: zone })}>Use this time zone</button>
      </section>

      <section className={s.settingsGroup}>
        <h2 className={s.h2}>Spotify</h2>
        <p className={s.quiet}>
          Spotify confirms each recording exactly — performers and all — and notices what you’ve played. It needs a Spotify app of your own:
          create one at developer.spotify.com, add <span className={s.mono}>{redirectUriFor()}</span> as a redirect URI, and paste its Client ID here.
        </p>
        {spotify.connected ? (
          <div className={s.row}>
            <span>Connected.</span>
            <button className={s.textButton} onClick={() => syncSpotify().then((n) => say(n ? 'Picked up recent listening.' : 'Nothing new from Spotify.')).catch(() => say('Spotify can’t be reached right now.', 'danger'))}>Check recent listening</button>
            <button className={s.textButton} onClick={() => { spotify.setTokens(null); bump() }}>Disconnect</button>
          </div>
        ) : (
          <>
            <Field label="Spotify Client ID" value={clientId} onChange={(e) => setClientId(e.target.value)} autoComplete="off" spellCheck={false} />
            <button className={s.textButton} onClick={connectSpotify}>Connect Spotify</button>
          </>
        )}
      </section>

      <section className={s.settingsGroup}>
        <h2 className={s.h2}>Notion</h2>
        {status?.notion ? (
          <>
            <p className={s.quiet}>Your notebook is mirrored to Notion: a journal of programmes, your threads, the recordings you’ve met, and your taste in words.</p>
            {notionState.error && <p className={s.note}>{notionState.error}</p>}
            <button className={s.textButton} onClick={() => void syncNotion()} disabled={notionState.syncing}>{notionState.syncing ? 'Updating Notion…' : 'Update Notion now'}</button>
          </>
        ) : (
          <p className={s.quiet}>Not connected. The server needs LONG_LISTEN_NOTION_TOKEN and LONG_LISTEN_NOTION_PAGE_ID — see LONG_LISTEN.md.</p>
        )}
      </section>

      <section className={s.settingsGroup}>
        <h2 className={s.h2}>Appearance</h2>
        <SegmentedControl
          label="Theme"
          value={settings.theme}
          onChange={(v) => updateSettings({ theme: v as ThemeChoice })}
          options={[{ value: 'system', label: 'Device' }, { value: 'light', label: 'Day' }, { value: 'dark', label: 'Night' }]}
        />
      </section>

      <section className={s.settingsGroup}>
        <h2 className={s.h2}>Your journey, in a file</h2>
        <p className={s.quiet}>Everything lives on this device. Keep a copy now and then — it restores on any browser.</p>
        <div className={s.row}>
          <button className={s.textButton} onClick={exportBackup}>Save a backup</button>
          <button className={s.textButton} onClick={() => fileRef.current?.click()}>Restore from a backup</button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void importBackup(f); e.target.value = '' }} />
        </div>
      </section>

      {status?.prompts && (
        <section className={s.settingsGroup}>
          <h2 className={s.h2}>Curator prompts</h2>
          <p className={s.mono}>{Object.values(status.prompts).join(' · ')}</p>
        </section>
      )}

      {import.meta.env.DEV && (
        <section className={s.settingsGroup}>
          <h2 className={s.h2}>Development</h2>
          <label className={s.row}>
            <input type="checkbox" checked={settings.demo} onChange={(e) => updateSettings({ demo: e.target.checked })} />
            Use the demo curator (canned programmes, no Anthropic key)
          </label>
        </section>
      )}
    </div>
  )
}
