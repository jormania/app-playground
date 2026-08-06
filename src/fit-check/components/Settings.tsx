import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
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
}

/**
 * Settings is Gabriel's screen, not Nora's — she should never need to open it.
 * Everything here is bring-your-own-key per repo convention: nothing ships in
 * the repo, and none of it leaves this device except as a per-request header.
 */
export default function Settings({
  config, onChange, wardrobes, garments, wardrobeBusy, wardrobeProgress,
  onCreateWardrobe, onRenameWardrobe, onToggleWardrobe, onDeleteWardrobe,
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
            value={config.notionToken}
            onChange={(e) => onChange({ notionToken: e.target.value })}
            hint="Leave empty to explore with the demo wardrobe."
          />
          <Field
            label="Garments database ID"
            value={config.garmentsDbId}
            onChange={(e) => onChange({ garmentsDbId: e.target.value })}
          />
          <Field
            label="Wardrobes database ID"
            value={config.wardrobesDbId}
            onChange={(e) => onChange({ wardrobesDbId: e.target.value })}
            hint="Without this, your wardrobes can't be saved or shared between devices."
          />
          <Field
            label="Outfits database ID"
            value={config.outfitsDbId}
            onChange={(e) => onChange({ outfitsDbId: e.target.value })}
          />
        </div>
        <div style={{ marginTop: 12 }}>
          <Button variant="secondary" onClick={testConnection} disabled={testing}>
            {testing ? 'Checking…' : 'Test connection'}
          </Button>
        </div>
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
          value={config.anthropicKey}
          onChange={(e) => onChange({ anthropicKey: e.target.value })}
          hint="Without this, tags are added by hand."
        />
      </section>
    </>
  )
}
