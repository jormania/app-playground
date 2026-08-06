import { useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { Button, Field, SegmentedControl } from '../../ds'
import { NotionClient } from '../lib/notionClient.ts'
import type { FitCheckConfig } from '../lib/config.ts'

interface Props {
  config: FitCheckConfig
  onChange: (patch: Partial<FitCheckConfig>) => void
}

/**
 * Settings is Gabriel's screen, not Nora's — she should never need to open it.
 * Everything here is bring-your-own-key per repo convention: nothing ships in
 * the repo, and none of it leaves this device except as a per-request header.
 */
export default function Settings({ config, onChange }: Props) {
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

      <section className="fc-settings-group">
        <h2>Your two homes</h2>
        <p className="fc-settings-hint">
          Call them whatever you actually call them. Only the names change — nothing moves.
        </p>
        <div className="fc-field-stack">
          <Field
            label="First home"
            value={config.homeNames['Home A']}
            placeholder="Home A"
            onChange={(e) =>
              onChange({ homeNames: { ...config.homeNames, 'Home A': e.target.value } })
            }
          />
          <Field
            label="Second home"
            value={config.homeNames['Home B']}
            placeholder="Home B"
            onChange={(e) =>
              onChange({ homeNames: { ...config.homeNames, 'Home B': e.target.value } })
            }
          />
        </div>
      </section>

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
