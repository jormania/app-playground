import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle2, AlertCircle, Loader2, MessageCircleHeart, PlugZap, Save, X } from 'lucide-react'
import { Button } from '../components/Button'
import { Field } from '../components/Field'
import { Switch } from '../components/Switch'
import { isConfigured, type Settings } from '../lib/settings'
import { useSettings } from '../lib/settingsContext'
import { listActiveOdysseys, type OdysseyDetail } from '../lib/notion'
import { verifyAnthropicKey } from '../lib/companion'
import { capabilities, enableReminders, unregisterPeriodicSync } from '../lib/reminders'

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
  const [reminderMsg, setReminderMsg] = useState('')
  const caps = capabilities()

  /** Toggle reminders: enabling requests notification permission and best-effort registers
   *  background sync; if permission is refused we flip back off and explain. */
  async function toggleReminders(on: boolean) {
    if (!on) {
      update({ remindersEnabled: false })
      setReminderMsg('')
      void unregisterPeriodicSync()
      return
    }
    update({ remindersEnabled: true })
    const permission = await enableReminders()
    if (permission !== 'granted') {
      update({ remindersEnabled: false })
      setReminderMsg('Notifications are blocked in your browser — allow them to use reminders.')
    } else if (!caps.periodicSync) {
      setReminderMsg('Background reminders aren’t supported on this browser/device — you’ll still see reminders inside the app.')
    } else {
      setReminderMsg('')
    }
  }

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
    // Success is shown by the green "Connected — N Odysseys" panel, not the "Saved." label
    // (which belongs to the Save button). Testing still persists the form via update() above.
  })

  // The companion key check lives in its own section with its own button + result.
  const testKey = useMutation<void, Error>({
    mutationFn: () => {
      update(form)
      return verifyAnthropicKey(form.anthropicKey)
    },
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
          Everything Sol Odyssey needs is set here — your <strong>Notion</strong> connection (where
          your records live), your <strong>buddy</strong>, what <strong>guidance</strong> you see,
          and an optional <strong>AI companion</strong>. Every value, including tokens and keys, is
          stored <strong>only in this browser</strong> — never on a server or baked into the app.
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
          value={form.dsOdysseys}
          onChange={set('dsOdysseys')}
        />
        <Field
          label="Check-ins — database link"
          autoComplete="off"
          spellCheck={false}
          placeholder="Paste the database URL, or its ID"
          value={form.dsCheckins}
          onChange={set('dsCheckins')}
        />
        <Field
          label="Weekly Reflections — database link"
          autoComplete="off"
          spellCheck={false}
          placeholder="Paste the database URL, or its ID"
          value={form.dsReflections}
          onChange={set('dsReflections')}
        />

        <div className="flex flex-wrap items-center gap-3 pt-1">
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
            Test Notion connection
          </Button>
          {!ready && (
            <span className="font-sans text-sm text-text-secondary">
              Enter the token and all three database links to test.
            </span>
          )}
        </div>

        {test.isError && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-md border border-caution/40 bg-background-primary p-4"
          >
            <AlertCircle size={20} className="mt-0.5 shrink-0 text-caution" aria-hidden />
            <p className="font-sans text-sm text-text-primary">{test.error.message}</p>
          </div>
        )}

        {test.isSuccess && (
          <div className="flex flex-col gap-2 rounded-md border border-success/40 bg-background-primary p-4">
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
          description="When on, a “Reflect with your companion” appears wherever you’ve written something to reflect on — your daily check-in (once today is logged), your weekly reflection, and your safety line. It mirrors back your own words."
          checked={settings.companionEnabled}
          onCheckedChange={(v) => update({ companionEnabled: v })}
        />

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button
            variant="secondary"
            onClick={() => testKey.mutate()}
            disabled={!form.anthropicKey.trim() || testKey.isPending}
          >
            {testKey.isPending ? (
              <Loader2 size={18} className="animate-spin" aria-hidden />
            ) : (
              <MessageCircleHeart size={18} aria-hidden />
            )}
            Test AI companion key
          </Button>
          {!form.anthropicKey.trim() && (
            <span className="font-sans text-sm text-text-secondary">Add a key to test it.</span>
          )}
        </div>

        {testKey.isError && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-md border border-caution/40 bg-background-primary p-4"
          >
            <AlertCircle size={20} className="mt-0.5 shrink-0 text-caution" aria-hidden />
            <p className="font-sans text-sm text-text-primary">{testKey.error.message}</p>
          </div>
        )}

        {testKey.isSuccess && (
          <div className="flex items-center gap-2 rounded-md border border-success/40 bg-background-primary p-4">
            <CheckCircle2 size={20} className="text-success" aria-hidden />
            <p className="font-sans text-sm font-medium text-text-primary">
              Key works — the companion is ready.
            </p>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-tertiary bg-background-secondary p-6">
        <h3 className="font-display text-lg">Reminders (optional)</h3>
        <p className="font-sans text-sm text-text-secondary">
          Gentle nudges: a <strong>daily</strong> reminder to log (at your Daily check-in time) and a
          <strong> weekly</strong> one to reflect (at your Weekly call slot), plus when a{' '}
          <strong>planned Odyssey’s start</strong> arrives and when you reach the{' '}
          <strong>summit</strong> (Day 42). They’re <strong>local and best-effort</strong> — on your
          device only, nothing is sent on your behalf, and timing is approximate.
        </p>
        <Switch
          label="Enable reminders"
          description="Asks your browser’s permission to show notifications."
          checked={settings.remindersEnabled}
          onCheckedChange={toggleReminders}
        />
        <p className="font-sans text-xs text-text-secondary">
          {caps.supported
            ? 'Background reminders work best in an installed app on Android or desktop Chrome. On iPhone they can’t run in the background — you’ll still see reminders inside the app.'
            : 'This browser can’t run background reminders — you’ll still see them inside the app when you open it.'}
        </p>
        {reminderMsg && <p className="font-sans text-sm text-caution">{reminderMsg}</p>}
      </section>

      <section className="flex flex-wrap items-center gap-3">
        <Button onClick={handleSave}>
          <Save size={18} aria-hidden />
          Save to this device
        </Button>
        {saved && <span className="font-sans text-sm text-text-secondary">Saved.</span>}
      </section>
    </div>
  )
}
