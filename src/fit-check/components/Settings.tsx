import { useEffect, useRef, useState } from 'react'
import { Check, Loader2, RefreshCw } from 'lucide-react'
import { Button, Field, SegmentedControl } from '../../ds'
import { NotionClient } from '../lib/notionClient.ts'
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
 */
function commitOnBlur(current: string, onCommit: (value: string) => void) {
  return {
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      if (e.target.value !== current) onCommit(e.target.value)
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') e.currentTarget.blur()
    },
  }
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
        <span>Everything here saves as you type.</span>
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
            label="Garments database ID"
            defaultValue={config.garmentsDbId}
            {...commitOnBlur(config.garmentsDbId, (v) => onChange({ garmentsDbId: v }))}
          />
          <Field
            label="Wardrobes database ID"
            defaultValue={config.wardrobesDbId}
            {...commitOnBlur(config.wardrobesDbId, (v) => onChange({ wardrobesDbId: v }))}
            hint="Without this, your wardrobes can't be saved or shared between devices."
          />
          <Field
            label="Outfits database ID"
            defaultValue={config.outfitsDbId}
            {...commitOnBlur(config.outfitsDbId, (v) => onChange({ outfitsDbId: v }))}
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
