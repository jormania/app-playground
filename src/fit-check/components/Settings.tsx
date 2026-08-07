import { useEffect, useRef, useState } from 'react'
import { Check, Loader2, RefreshCw } from 'lucide-react'
import { Button, Field, SegmentedControl } from '../../ds'
import { NotionClient } from '../lib/notionClient.ts'
import { parseNotionId } from '../../shared/notionId.ts'
import WardrobeManager from './WardrobeManager.tsx'
import type { FitCheckConfig } from '../lib/config.ts'
import type { Wardrobe } from '../lib/wardrobes.ts'
import type { Garment } from '../lib/types.ts'

interface Props {
  config: FitCheckConfig
  onChange: (patch: Partial<FitCheckConfig>) => void
  wardrobes: Wardrobe[]
  garments: Garment[]
  wardrobeBusy: boolean
  wardrobeProgress: string
  onCreateWardrobe: (name: string, order: number) => Promise<void>
  onRenameWardrobe: (id: string, name: string) => Promise<void>
  onToggleWardrobe: (id: string, active: boolean) => Promise<void>
  onDeleteWardrobe: (wardrobe: Wardrobe) => Promise<void>
  demoMode: boolean
  syncing: boolean
  onSync: () => void
}

/**
 * Commit a text field's value on blur (or Enter) rather than on every
 * keystroke — same pattern as WardrobeManager's rename input.
 *
 * This matters more here than there: `notionToken`/`garmentsDbId`/
 * `wardrobesDbId`/`outfitsDbId` are exactly App's data-fetch effect
 * dependencies, so a live-on-every-keystroke `onChange` was firing three
 * parallel Notion requests per character typed into a 32-char token — comfortably
 * enough to trip the 20-req/10s rate limiter in api/_shared.js before the user
 * even finished typing, surfacing "Too many requests" instead of whatever the
 * credentials actually meant. Committing on blur means Notion only ever sees
 * one attempt per finished edit, so a genuinely bad token now shows Notion's
 * own specific message ("API token is invalid.") instead of the limiter's.
 *
 * `current` guards against a no-op commit (tabbing through without editing).
 *
 * `transform` lets the database fields accept a pasted Notion URL and store the
 * bare id — see `commitId` below.
 */
function commitOnBlur(
  current: string,
  onCommit: (value: string) => void,
  transform: (raw: string) => string = (v) => v,
) {
  return {
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      const value = transform(e.target.value)
      // Reflect the normalised value back into the (uncontrolled) input, so
      // pasting a URL visibly resolves to the id rather than leaving the box
      // showing something different from what was stored.
      if (e.target.value !== value) e.target.value = value
      if (value !== current) onCommit(value)
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') e.currentTarget.blur()
    },
  }
}

/**
 * Database fields accept whatever Notion's "Copy link" produces, not just a
 * bare id — that's what people actually paste, and asking for "the ID" means
 * explaining where to find a 32-char hex string inside a URL.
 *
 * An unrecognisable value is kept verbatim rather than silently blanked: if
 * someone pastes something odd, showing it back (and letting "Test connection"
 * fail with a real message) beats wiping the field and leaving them guessing.
 */
function commitId(current: string, onCommit: (value: string) => void) {
  return commitOnBlur(current, onCommit, (raw) => {
    const trimmed = raw.trim()
    if (!trimmed) return ''
    return parseNotionId(trimmed) || trimmed
  })
}

/**
 * Settings is Gabriel's screen, not Nora's — she should never need to open it.
 * Everything here is bring-your-own-key per repo convention: nothing ships in
 * the repo, and none of it leaves this device except as a per-request header.
 */
export default function Settings({
  config, onChange, wardrobes, garments, wardrobeBusy, wardrobeProgress,
  onCreateWardrobe, onRenameWardrobe, onToggleWardrobe, onDeleteWardrobe,
  demoMode, syncing, onSync,
}: Props) {
  const [testing, setTesting] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null)

  // There is no Save button: App persists `config` on every change. That's the
  // right behaviour (nothing to lose, nothing to submit) but it's invisible, and
  // the first person to open this screen went looking for a button that was
  // never coming. So the save announces itself instead.
  //
  // Keyed off the config VALUE changing, not off a render count. A
  // "skip the first render" ref is the obvious version and it's wrong: React
  // StrictMode invokes effects twice on mount, so the second pass sees the ref
  // already flipped and flashes "Saved" before anything has been.
  //
  // Now that the credential fields commit on blur rather than per keystroke,
  // this also stops flashing erratically while someone is mid-paste into a
  // token field — it fires once, when the edit actually lands.
  const [justSaved, setJustSaved] = useState(false)
  const lastSeen = useRef(config)
  useEffect(() => {
    if (lastSeen.current === config) return
    lastSeen.current = config
    setJustSaved(true)
    const timer = setTimeout(() => setJustSaved(false), 1800)
    return () => clearTimeout(timer)
  }, [config])

  async function testConnection() {
    setTesting(true)
    setStatus(null)
    const client = new NotionClient(config.notionToken, {
      garments: config.garmentsDbId,
      outfits: config.outfitsDbId,
      wardrobes: config.wardrobesDbId,
    })
    setStatus(await client.testConnection())
    setTesting(false)
  }

  return (
    <>
      {/* Note first, pill second: the pill keeps its space when hidden (so
          nothing jumps as it fades), and putting it last means that reserved
          space sits at the right-hand edge instead of indenting the note. */}
      <p className="fc-autosave" role="status">
        {/* Not "saves as you type" any more: since M5.5 the token/database
            fields commit when you leave them, so that wording was actively
            wrong for the exact fields people are most anxious about. */}
        <span>Everything here saves itself. There's no Save button.</span>
        <span
          className="fc-autosave-flash"
          data-visible={justSaved}
          aria-hidden={!justSaved}
        >
          <Check size={14} aria-hidden="true" /> Saved
        </span>
      </p>

      <section className="fc-settings-group">
        <h2>Appearance</h2>
        <p className="fc-settings-hint">Follows your phone unless you pick one.</p>
        <SegmentedControl
          value={config.theme ?? 'system'}
          onChange={(v) => onChange({ theme: v === 'system' ? null : (v as 'light' | 'dark') })}
          options={[
            { value: 'system', label: 'Auto' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </section>

      <WardrobeManager
        wardrobes={wardrobes}
        garments={garments}
        busy={wardrobeBusy}
        progress={wardrobeProgress}
        onCreate={onCreateWardrobe}
        onRename={onRenameWardrobe}
        onToggleActive={onToggleWardrobe}
        onDelete={onDeleteWardrobe}
      />

      <section className="fc-settings-group">
        <h2>Notion</h2>
        <p className="fc-settings-hint">
          Stored on this device only, and sent straight to Notion with each request.
          New to this?{' '}
          <a href="https://app.notion.com/p/3b5d3e6d60db81c987d8fbbf162ed216" target="_blank" rel="noopener noreferrer">
            Duplicate the Starter Template
          </a>{' '}
          for all three databases already set up, or the{' '}
          <a href="/fit-check-guide.html" target="_blank" rel="noopener noreferrer">guide</a>{' '}
          walks through the whole thing.
        </p>
        <div className="fc-field-stack">
          <Field
            label="Notion token"
            type="password"
            autoComplete="off"
            defaultValue={config.notionToken}
            {...commitOnBlur(config.notionToken, (v) => onChange({ notionToken: v }))}
            hint="Leave empty to explore with the demo wardrobe."
          />
          <Field
            label="Garments database"
            defaultValue={config.garmentsDbId}
            {...commitId(config.garmentsDbId, (v) => onChange({ garmentsDbId: v }))}
            hint="Paste the Notion link or the ID — either works."
          />
          <Field
            label="Wardrobes database"
            defaultValue={config.wardrobesDbId}
            {...commitId(config.wardrobesDbId, (v) => onChange({ wardrobesDbId: v }))}
            hint="Without this, your wardrobes can't be saved or shared between devices."
          />
          <Field
            label="Outfits database"
            defaultValue={config.outfitsDbId}
            {...commitId(config.outfitsDbId, (v) => onChange({ outfitsDbId: v }))}
          />
        </div>
        <div className="fc-actions" style={{ marginTop: 12 }}>
          <Button variant="secondary" onClick={testConnection} disabled={testing}>
            {testing ? 'Checking…' : 'Test connection'}
          </Button>
          <Button
            variant="ghost"
            onClick={onSync}
            disabled={syncing || demoMode}
            title={demoMode ? "There's nothing to sync in demo mode." : undefined}
          >
            {syncing
              ? <><Loader2 size={16} className="fc-spin" aria-hidden="true" /> Syncing…</>
              : <><RefreshCw size={16} aria-hidden="true" /> Sync now</>}
          </Button>
        </div>
        {/* If you've fixed a typo or corrected a tag straight in Notion, this
            pulls it in without reloading the whole app and losing your tab. */}
        <p className="fc-settings-hint" style={{ marginTop: 4 }}>
          {demoMode
            ? 'Connect Notion above to sync.'
            : 'Edited something directly in Notion? Sync pulls it in.'}
        </p>
        {status && (
          <p className="fc-status" data-ok={status.ok} role="status">
            {status.message}
          </p>
        )}
      </section>

      <section className="fc-settings-group">
        <h2>AI tagging</h2>
        <p className="fc-settings-hint">
          Used once per photo to suggest tags. Nothing else is sent.
        </p>
        <Field
          label="Anthropic API key"
          type="password"
          autoComplete="off"
          defaultValue={config.anthropicKey}
          {...commitOnBlur(config.anthropicKey, (v) => onChange({ anthropicKey: v }))}
          hint="Without this, tags are added by hand."
        />
      </section>
    </>
  )
}
