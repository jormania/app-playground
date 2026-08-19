import { useState } from 'react'
import type { FocusEvent, KeyboardEvent } from 'react'
import { Button, Field, SettingsToggle, ConfirmModal } from '../../ds'
import { SilvaStore, resetDemoThings } from '../lib/store'
import type { SilvaConfig } from '../lib/settingsConfig'
import styles from './SettingsView.module.css'

export interface SettingsViewProps {
  config: SilvaConfig
  onChange: (patch: Partial<SilvaConfig>) => void
  /** Live progress of the background embedding pass, or null when idle. */
  indexing?: { done: number; total: number; loadingModel: boolean } | null
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
export function SettingsView({ config, onChange, indexing = null }: SettingsViewProps) {
  const [testing, setTesting] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null)
  const [confirmingReset, setConfirmingReset] = useState(false)

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

      {/* Display toggles — nothing here changes what's kept, only what's
       *  shown. Everything defaults on; each toggle exists for someone who'd
       *  rather one specific piece stay out of the way, not because any of
       *  them are wrong at the sizes most forests start at. */}
      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>What's shown</h4>
        <SettingsToggle
          label="Show the walk"
          hint="The short stretch above the Forest's scroll, weighted toward what you haven't looked at. Off leaves just the scroll."
          checked={config.showWalk}
          onChange={(e) => onChange({ showWalk: e.target.checked })}
        />
        <SettingsToggle
          label="Show the graph"
          hint="The whole-forest visualisation in Underground. Off leaves the path list and the make-a-path form — paths themselves are unaffected."
          checked={config.showGraph}
          onChange={(e) => onChange({ showGraph: e.target.checked })}
        />
        <SettingsToggle
          label="Let Silva offer provocations"
          hint="Off means what's already the default state otherwise: silence. On, a provocation appears at most once a session, and only when something's actually changed."
          checked={config.provocationsEnabled}
          onChange={(e) => onChange({ provocationsEnabled: e.target.checked })}
        />
      </section>

      {/* The underground layer is the half of Silva that isn't a randomiser,
       *  so it gets its own section rather than living as a checkbox under
       *  "advanced" — but it stays opt-in, because turning it on downloads a
       *  ~25 MB model and doing that unasked on someone's phone data isn't
       *  this app's call to make. */}
      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>The underground</h4>
        <p className={styles.sectionHint}>
          Lets Silva quietly notice which things grew near each other. This is what
          draws the oxblood threads in the Underground, and what makes the provocations
          that aren't just a coin flip — near neighbours, a clearing forming, a tension.
          Runs entirely on this device; nothing is ever sent anywhere.
        </p>
        <SettingsToggle
          label="Let Silva notice things"
          hint="First time only: downloads a ~25 MB model, then works offline."
          checked={config.mycorrhizaEnabled}
          onChange={(e) => onChange({ mycorrhizaEnabled: e.target.checked })}
        />
        {indexing && (
          <p className={styles.status}>
            {indexing.loadingModel || indexing.done === 0
              ? 'Fetching the model — first time only…'
              : `Noticing… ${indexing.done} of ${indexing.total}.`}
          </p>
        )}
      </section>

      <section className={styles.section}>
        <h4 className={styles.sectionTitle}>Anthropic</h4>
        <p className={styles.sectionHint}>
          Used for Tension — a provocation that needs a real judgment call, not just a
          similarity score — and, if you turn it on below, transcribing photographed
          pages. Every other provocation works without this.
        </p>
        <Field
          label="Anthropic API key"
          type="password"
          autoComplete="off"
          defaultValue={config.anthropicKey}
          {...commitOnBlur(config.anthropicKey, (v) => onChange({ anthropicKey: v }))}
          hint="Without this, Tension is simply never offered."
        />
        {/* A separate opt-in from merely having the key set — sending a
         *  photograph to a third party is a different privacy trade than
         *  sending text for Tension, and gets its own explicit consent
         *  rather than riding along on the key silently. */}
        <SettingsToggle
          label="Transcribe photographed pages automatically"
          hint="The moment you photograph a page, its text is pulled out and added as the thing's passage — nothing to type. Needs the key above; verbatim only, never a description of the photo."
          checked={config.autoTranscribe}
          onChange={(e) => onChange({ autoTranscribe: e.target.checked })}
        />
      </section>

      {!config.notionToken && (
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>The demo forest</h4>
          <p className={styles.sectionHint}>
            With no token set you're walking a demo forest, kept on this device. Anything
            you add to it stays until you reset it here.
          </p>
          <Button size="sm" variant="danger" onClick={() => setConfirmingReset(true)}>
            Reset the demo forest
          </Button>
        </section>
      )}

      <ConfirmModal
        isOpen={confirmingReset}
        title="Reset the demo forest"
        message="Everything you've added to the demo forest is dropped and the original specimens come back. Nothing in Notion is touched."
        confirmText="Reset"
        variant="danger"
        onCancel={() => setConfirmingReset(false)}
        onConfirm={() => {
          resetDemoThings()
          setConfirmingReset(false)
          window.location.reload()
        }}
      />
    </div>
  )
}
