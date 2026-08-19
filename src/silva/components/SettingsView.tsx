import { useState } from 'react'
import type { FocusEvent, KeyboardEvent } from 'react'
import { Button, Field } from '../../ds'
import { SilvaStore } from '../lib/store'
import type { SilvaConfig } from '../lib/settingsConfig'
import styles from './SettingsView.module.css'

export interface SettingsViewProps {
  config: SilvaConfig
  onChange: (patch: Partial<SilvaConfig>) => void
}

/**
 * Commit a field's value on blur (or Enter), not on every keystroke — same
 * reasoning as Fit Check's Settings: `notionToken` is an App.tsx data-fetch
 * dependency, so live-on-every-keystroke would fire a new Notion load per
 * character typed into the token.
 */
function commitOnBlur(current: string, onCommit: (value: string) => void) {
  return {
    onBlur: (e: FocusEvent<HTMLInputElement>) => {
      if (e.target.value !== current) onCommit(e.target.value)
    },
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') e.currentTarget.blur()
    },
  }
}

/** Settings — where a Notion token and an Anthropic key live (SILVA.md's
 *  build plan deferred both; this is that session). Silva's four database
 *  ids are fixed to the owner's own live databases (see store.ts's
 *  DEFAULT_*_DATABASE_ID) — there's nothing else to configure per device. */
export function SettingsView({ config, onChange }: SettingsViewProps) {
  const [testing, setTesting] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null)

  async function testConnection() {
    setTesting(true)
    setStatus(null)
    const store = new SilvaStore(config.notionToken)
    setStatus(await store.testConnection())
    setTesting(false)
  }

  return (
    <div className={styles.wrap}>
      {/* A PWA installed from the home screen never passes index.html's app
       *  card, so this is the only route back to the guide once installed —
       *  same reasoning as Fit Check's Settings. */}
      <a className={styles.guideLink} href="/silva-guide.html" target="_blank" rel="noopener noreferrer">
        How Silva works — a short guide
      </a>

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Notion</h4>
        <p className={styles.sectionHint}>
          Stored on this device only, sent straight to Notion with each request. Leave
          empty to keep exploring the demo forest.
        </p>
        <Field
          label="Notion token"
          type="password"
          autoComplete="off"
          defaultValue={config.notionToken}
          {...commitOnBlur(config.notionToken, (v) => onChange({ notionToken: v }))}
        />
        <div className={styles.actions}>
          <Button size="sm" variant="outline" onClick={testConnection} disabled={testing}>
            {testing ? 'Checking…' : 'Test connection'}
          </Button>
        </div>
        {status && (
          <p className={styles.status} data-ok={status.ok}>
            {status.message}
          </p>
        )}
      </section>

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Anthropic</h4>
        <p className={styles.sectionHint}>
          Only used for Tension — a provocation that needs a real judgment call, not just
          a similarity score. Every other provocation works without this.
        </p>
        <Field
          label="Anthropic API key"
          type="password"
          autoComplete="off"
          defaultValue={config.anthropicKey}
          {...commitOnBlur(config.anthropicKey, (v) => onChange({ anthropicKey: v }))}
          hint="Without this, Tension is simply never offered."
        />
      </section>
    </div>
  )
}
