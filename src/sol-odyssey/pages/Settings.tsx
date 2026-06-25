import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle2, AlertCircle, Loader2, PlugZap, Save, X } from 'lucide-react'
import { Button } from '../components/Button'
import { Field } from '../components/Field'
import { Switch } from '../components/Switch'
import { isConfigured, type Settings } from '../lib/settings'
import { useSettings } from '../lib/settingsContext'
import { listActiveOdysseys, type OdysseyDetail } from '../lib/notion'

/** The text fields the connection form owns (booleans are handled by the toggles below, so
 *  saving the form never clobbers them). */
type StringKey =
  | 'token'
  | 'dsOdysseys'
  | 'dsCheckins'
  | 'dsReflections'
  | 'buddyName'
  | 'buddyEmail'
  | 'dailyTime'
  | 'weeklySlot'
  | 'anthropicKey'

const STRING_KEYS: StringKey[] = [
  'token',
  'dsOdysseys',
  'dsCheckins',
  'dsReflections',
  'buddyName',
  'buddyEmail',
  'dailyTime',
  'weeklySlot',
  'anthropicKey',
]

export function SettingsPage({ navigate }: { navigate: (to: string) => void }) {
  const { settings, update } = useSettings()
  const [form, setForm] = useState<Record<StringKey, string>>(() =>
    Object.fromEntries(STRING_KEYS.map((k) => [k, settings[k]])) as Record<StringKey, string>,
  )
  const [saved, setSaved] = useState(false)

  const set =
    (key: StringKey) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm((f) => ({ ...f, [key]: e.target.value }))
      setSaved(false)
    }

  const formAsSettings = { ...settings, ...form } as Settings
  const ready = isConfigured(formAsSettings)

  const test = useMutation<OdysseyDetail[], Error>({
    mutationFn: () => {
      update(form)
      return listActiveOdysseys({ token: form.token, dsOdysseys: form.dsOdysseys })
    },
    // Success is shown by the green "Connected — N Odysseys" panel below, not the "Saved." label
    // (which belongs to the Save button). Testing still persists the form via update() above.
  })

  function handleSave() {
    update(form)
    setSaved(true)
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-2xl">Settings</h2>
          <button
            onClick={() => navigate('/')}
            aria-label="Close settings"
            className="rounded-md p-1.5 text-text-secondary transition-colors duration-fast hover:bg-background-secondary"
          >
            <X size={20} aria-hidden />
          </button>
        </div>
        <p className="max-w-prose font-sans text-text-secondary">
          Sol Odyssey keeps your records in <strong>your</strong> Notion workspace. Paste your
          integration token and the links to your three databases below — they’re stored only in
          this browser, never on a server or in the app itself.
        </p>
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-tertiary bg-background-secondary p-6">
        <h3 className="font-display text-lg">Notion connection</h3>
        <Field
          label="Notion integration token"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="ntn_… or secret_…"
          hint="Create an internal integration in Notion and share your three databases with it."
          value={form.token}
          onChange={set('token')}
        />
        <Field
          label="Odysseys — database link"
          autoComplete="off"
          spellCheck={false}
          placeholder="Paste the database URL, or its ID"
          hint="Open the database in Notion, Copy link, and paste it here"
          value={form.dsOdysseys}
          onChange={set('dsOdysseys')}
        />
        <Field
          label="Check-ins — database link"
          autoComplete="off"
          spellCheck={false}
          placeholder="Paste the database URL, or its ID"
          hint="Open the database in Notion, Copy link, and paste it here"
          value={form.dsCheckins}
          onChange={set('dsCheckins')}
        />
        <Field
          label="Weekly Reflections — database link"
          autoComplete="off"
          spellCheck={false}
          placeholder="Paste the database URL, or its ID"
          hint="Open the database in Notion, Copy link, and paste it here"
          value={form.dsReflections}
          onChange={set('dsReflections')}
        />
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-tertiary bg-background-secondary p-6">
        <h3 className="font-display text-lg">Your buddy</h3>
        <p className="font-sans text-sm text-text-secondary">
          One human who knows what you’re attempting and checks in. Recorded here only — Sol
          Odyssey doesn’t message anyone.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Buddy name" value={form.buddyName} onChange={set('buddyName')} />
          <Field
            label="Buddy email"
            type="email"
            autoComplete="off"
            value={form.buddyEmail}
            onChange={set('buddyEmail')}
          />
          <Field
            label="Daily check-in time"
            type="time"
            value={form.dailyTime}
            onChange={set('dailyTime')}
          />
          <Field
            label="Weekly call slot"
            placeholder="e.g. Sun 18:00"
            value={form.weeklySlot}
            onChange={set('weeklySlot')}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-tertiary bg-background-secondary p-6">
        <h3 className="font-display text-lg">Guidance</h3>
        <p className="font-sans text-sm text-text-secondary">
          New here? Keep these on for gentle background notes along the way. Switch them off once
          the method is second nature.
        </p>
        <Switch
          label="Show gentle background notes"
          description="Optional “why this?” twisties tucked beside the practical fields."
          checked={settings.showGuidance}
          onCheckedChange={(v) => update({ showGuidance: v })}
        />
        <Switch
          label="Show the landing page"
          description="The short intro screen shown at home before an Odyssey is under way."
          checked={settings.showLanding}
          onCheckedChange={(v) => update({ showLanding: v })}
        />
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-tertiary bg-background-secondary p-6">
        <h3 className="font-display text-lg">AI companion (optional)</h3>
        <p className="font-sans text-sm text-text-secondary">
          A gentle reflective witness for the in-between — it mirrors back what you write on a
          check-in or weekly reflection. It’s optional and never replaces your human buddy, who
          stays the heart of the process. Add your own Anthropic key to enable it; the key lives
          only on this device, and your text goes straight to Anthropic under your key — never to a
          server of ours.
        </p>
        <Field
          label="Anthropic API key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="sk-ant-…"
          value={form.anthropicKey}
          onChange={set('anthropicKey')}
        />
        <Switch
          label="Enable the AI companion"
          description="Show an optional “reflect with your companion” on Today and Weekly."
          checked={settings.companionEnabled}
          onCheckedChange={(v) => update({ companionEnabled: v })}
        />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleSave}>
            <Save size={18} aria-hidden />
            Save to this device
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setSaved(false) // clear any stale "Saved." so only the connection result shows
              test.mutate()
            }}
            disabled={!ready || test.isPending}
          >
            {test.isPending ? (
              <Loader2 size={18} className="animate-spin" aria-hidden />
            ) : (
              <PlugZap size={18} aria-hidden />
            )}
            Test connection
          </Button>
          {saved && !test.isPending && (
            <span className="font-sans text-sm text-text-secondary">Saved.</span>
          )}
        </div>

        {!ready && (
          <p className="font-sans text-sm text-text-secondary">
            Enter the token and all three database links to test the connection.
          </p>
        )}

        {test.isError && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-md border border-caution/40 bg-background-secondary p-4"
          >
            <AlertCircle size={20} className="mt-0.5 shrink-0 text-caution" aria-hidden />
            <p className="font-sans text-sm text-text-primary">{test.error.message}</p>
          </div>
        )}

        {test.isSuccess && (
          <div className="flex flex-col gap-2 rounded-md border border-success/40 bg-background-secondary p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={20} className="text-success" aria-hidden />
              <p className="font-sans text-sm font-medium text-text-primary">
                Connected — {test.data.length} active{' '}
                {test.data.length === 1 ? 'Odyssey' : 'Odysseys'} found.
              </p>
            </div>
            {test.data.length > 0 && (
              <ul className="ml-7 list-disc font-mono text-sm text-text-secondary">
                {test.data.map((o) => (
                  <li key={o.id}>{o.title}</li>
                ))}
              </ul>
            )}
            {test.data.length === 0 && (
              <p className="ml-7 font-sans text-sm text-text-secondary">
                The wiring works. No Odyssey is Active yet — that’s expected before you’ve
                started one.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
