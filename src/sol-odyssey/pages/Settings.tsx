import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle2, AlertCircle, Loader2, MessageCircleHeart, PlugZap, Save, Trash2, X } from 'lucide-react'
import { Button } from '../components/Button'
import { Field } from '../components/Field'
import { Select } from '../components/Select'
import { Switch } from '../components/Switch'
import { Modal } from '../components/Modal'
import { SupportingNote } from '../components/SupportingNote'
import { BuddyEmailButton } from '../components/BuddyEmailButton'
import { buddyWelcomeEmail } from '../lib/buddyMail'
import { clearSettings, isConfigured, isValidEmail, type Settings } from '../lib/settings'
import { useSettings } from '../lib/settingsContext'
import { useTheme } from '../lib/themeContext'
import { PRESETS, type PresetId } from '../lib/theme'
import { cn } from '../lib/cn'
import { normalizeNotionId, runConnectionTest, type ConnectionTest } from '../lib/notion'
import { verifyAnthropicKey } from '../lib/companion'
import { capabilities, enableReminders, notificationPermission, unregisterPeriodicSync, parseDailyTime, parseWeeklySlot, REMINDERS_DB } from '../lib/reminders'
import { gatherDiagnostics, type NotifyDiagnostics } from '../../shared/notify/diagnostics'
import { useDiagnosticsReveal } from '../../shared/notify/useDiagnosticsReveal'

const REMINDER_DIAG_KEYS = ['state', 'lastDailySent', 'lastWeeklySent', 'lastStartSent', 'lastHarvestSent']

/** The text fields the connection form owns (booleans are handled by the toggles below, so
 *  saving the form never clobbers them). */
type StringKey =
  | 'token'
  | 'dsOdysseys'
  | 'dsCheckins'
  | 'dsReflections'
  | 'userName'
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
  'userName',
  'buddyName',
  'buddyEmail',
  'dailyTime',
  'weeklySlot',
  'anthropicKey',
]

const WEEKDAYS = [
  { value: 'Sun', label: 'Sunday' },
  { value: 'Mon', label: 'Monday' },
  { value: 'Tue', label: 'Tuesday' },
  { value: 'Wed', label: 'Wednesday' },
  { value: 'Thu', label: 'Thursday' },
  { value: 'Fri', label: 'Friday' },
  { value: 'Sat', label: 'Saturday' },
]

/** Split a stored "Sun 18:00" slot into its day + time parts (tolerant of partials/legacy text). */
function slotParts(value: string): { day: string; time: string } {
  const dayToken = value.match(/[A-Za-z]+/)?.[0]?.slice(0, 3).toLowerCase() ?? ''
  const day = WEEKDAYS.find((d) => d.value.toLowerCase() === dayToken)?.value ?? ''
  const time = value.match(/\d{1,2}:\d{2}/)?.[0] ?? ''
  return { day, time }
}
function composeSlot(day: string, time: string): string {
  return [day, time].filter(Boolean).join(' ')
}

/** A gentle inline caution when a pasted database value has no parseable Notion ID. */
function LinkCaution({ value }: { value: string }) {
  if (!value.trim() || normalizeNotionId(value)) return null
  return (
    <p className="font-sans text-sm text-caution">
      That doesn’t look like a Notion link or ID — paste the database URL, or its 32-character ID.
    </p>
  )
}

export function SettingsPage({ navigate }: { navigate: (to: string) => void }) {
  const { settings, update, reload } = useSettings()
  const { preset, setPreset } = useTheme()
  const [clearing, setClearing] = useState(false)
  const [form, setForm] = useState<Record<StringKey, string>>(() =>
    Object.fromEntries(STRING_KEYS.map((k) => [k, settings[k]])) as Record<StringKey, string>,
  )
  const [saved, setSaved] = useState(false)
  const [reminderMsg, setReminderMsg] = useState('')
  const [reminderDiag, setReminderDiag] = useState<NotifyDiagnostics | null>(null)
  const caps = capabilities()

  // Undocumented: seven quick taps on the "Reminders" heading dumps the background
  // notification state (permission, periodic sync registration, last-sent guards) — the
  // same diagnostics trick Touch Grass uses, ported here since reminders rely on the exact
  // same fragile mechanism (a service worker woken by Periodic Background Sync).
  const handleReminderHeadingTap = useDiagnosticsReveal(async () => {
    setReminderDiag(await gatherDiagnostics({ dbName: REMINDERS_DB, keys: REMINDER_DIAG_KEYS }))
  })

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

  const test = useMutation<ConnectionTest, Error>({
    mutationFn: () => {
      update(form)
      return runConnectionTest({
        token: form.token,
        dsOdysseys: form.dsOdysseys,
        dsCheckins: form.dsCheckins,
        dsReflections: form.dsReflections,
      })
    },
    // Success is shown by the green "Connected" panel (+ any schema warnings), not the "Saved."
    // label (which belongs to the Save button). Testing still persists the form via update() above.
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
          your records live), <strong>you and your buddy</strong>, <strong>reminders</strong> and{' '}
          <strong>appearance</strong>, the <strong>guidance</strong> you see, and an optional{' '}
          <strong>AI companion</strong>. Every value, including tokens and keys, is stored{' '}
          <strong>only in this browser</strong> — never on a server or baked into the app.
        </p>
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-tertiary bg-background-secondary p-6">
        <h3 className="font-display text-lg">Notion connection</h3>
        <p className="font-sans text-sm text-text-secondary">
          New here?{' '}
          <a
            href="https://app.notion.com/p/Sol-Odyssey-Starter-Template-38fd3e6d60db8194b97ce4a920572617"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent underline"
          >
            Duplicate the Starter Template
          </a>{' '}
          to get all three databases pre-built, then paste each link below. The{' '}
          <a href="/sol-odyssey-guide.html" className="font-medium text-accent underline">
            field guide
          </a>{' '}
          walks through the whole setup.
        </p>
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
        <div className="flex flex-col gap-1.5">
          <Field
            label="Odysseys — database link"
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste the database URL, or its ID"
            value={form.dsOdysseys}
            onChange={set('dsOdysseys')}
          />
          <LinkCaution value={form.dsOdysseys} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Field
            label="Check-ins — database link"
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste the database URL, or its ID"
            value={form.dsCheckins}
            onChange={set('dsCheckins')}
          />
          <LinkCaution value={form.dsCheckins} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Field
            label="Weekly Reflections — database link"
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste the database URL, or its ID"
            value={form.dsReflections}
            onChange={set('dsReflections')}
          />
          <LinkCaution value={form.dsReflections} />
        </div>

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
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2 rounded-md border border-success/40 bg-background-primary p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={20} className="text-success" aria-hidden />
                <p className="font-sans text-sm font-medium text-text-primary">
                  Connected — {test.data.odysseys.length} active{' '}
                  {test.data.odysseys.length === 1 ? 'Odyssey' : 'Odysseys'} found.
                </p>
              </div>
              {test.data.odysseys.length > 0 && (
                <ul className="ml-7 list-disc font-mono text-sm text-text-secondary">
                  {test.data.odysseys.map((o) => (
                    <li key={o.id}>{o.title}</li>
                  ))}
                </ul>
              )}
              {test.data.odysseys.length === 0 && test.data.issues.length === 0 && test.data.unreachable.length === 0 && (
                <p className="ml-7 font-sans text-sm text-text-secondary">
                  The wiring works. No Odyssey is Active yet — that’s expected before you’ve started one.
                </p>
              )}
            </div>

            {test.data.unreachable.length > 0 && (
              <div className="flex flex-col gap-2 rounded-md border border-caution/40 bg-background-primary p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle size={20} className="text-caution" aria-hidden />
                  <p className="font-sans text-sm font-medium text-text-primary">
                    These databases couldn’t be reached — check the link and that it’s shared with your integration:
                  </p>
                </div>
                <ul className="ml-7 flex flex-col gap-1 font-sans text-sm text-text-secondary">
                  {test.data.unreachable.map((u) => (
                    <li key={u.db}>
                      <strong className="text-text-primary">{u.db}</strong>: {u.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {test.data.issues.length > 0 && (
              <div className="flex flex-col gap-2 rounded-md border border-caution/40 bg-background-primary p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle size={20} className="text-caution" aria-hidden />
                  <p className="font-sans text-sm font-medium text-text-primary">
                    Your databases are missing some properties — add these so saving works:
                  </p>
                </div>
                <ul className="ml-7 flex flex-col gap-1 font-sans text-sm text-text-secondary">
                  {test.data.issues.map((iss) => (
                    <li key={`${iss.db}-${iss.property}`}>
                      In <strong className="text-text-primary">{iss.db}</strong>: add a{' '}
                      <span className="font-mono">{iss.expectedType.replace('_', ' ')}</span> property named{' '}
                      <span className="font-mono text-text-primary">“{iss.property}”</span>
                      {iss.actualType ? ` (currently ${iss.actualType.replace('_', ' ')})` : ''}.
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-tertiary bg-background-secondary p-6">
        <h3 className="font-display text-lg">You &amp; your buddy</h3>
        <p className="font-sans text-sm text-text-secondary">
          The emails you draft are signed from <strong>you</strong> and sent to one{' '}
          <strong>buddy</strong> — the person who knows what you’re attempting and checks in.
          Recorded here only; Sol Odyssey doesn’t message anyone.
        </p>

        <div className="flex flex-col gap-3">
          <p className="font-sans text-xs font-semibold uppercase tracking-wide text-text-secondary">You</p>
          <Field
            label="Your name"
            hint="Shown in the subject of the emails you draft, so your buddy sees who they’re from."
            value={form.userName}
            onChange={set('userName')}
          />
        </div>

        <div className="flex flex-col gap-3">
          <p className="font-sans text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Your buddy
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Buddy name" value={form.buddyName} onChange={set('buddyName')} />
            <div className="flex flex-col gap-1.5">
              <Field
                label="Buddy email"
                type="email"
                autoComplete="off"
                value={form.buddyEmail}
                onChange={set('buddyEmail')}
              />
              {form.buddyEmail.trim() && !isValidEmail(form.buddyEmail) && (
                <p className="font-sans text-sm text-caution">
                  That email looks off — check it so you can actually reach your buddy.
                </p>
              )}
            </div>
            <Field
              label="Daily check-in time"
              type="time"
              value={form.dailyTime}
              onChange={set('dailyTime')}
            />
            <div />
            <Select
              label="Weekly call — day"
              placeholder="—"
              options={WEEKDAYS}
              value={slotParts(form.weeklySlot).day}
              onChange={(e) => {
                setForm((f) => ({ ...f, weeklySlot: composeSlot(e.target.value, slotParts(f.weeklySlot).time) }))
                setSaved(false)
              }}
            />
            <Field
              label="Weekly call — time"
              type="time"
              value={slotParts(form.weeklySlot).time}
              onChange={(e) => {
                setForm((f) => ({ ...f, weeklySlot: composeSlot(slotParts(f.weeklySlot).day, e.target.value) }))
                setSaved(false)
              }}
            />
          </div>
        </div>

        <Select
          label="Compose emails with"
          hint="Which email opens when you draft a note. On phones, your device’s default mail app is always used. Either way the note is copied to your clipboard, so you can paste it into any email."
          value={settings.mailProvider}
          options={[
            { value: 'default', label: 'Default mail app' },
            { value: 'gmail', label: 'Gmail' },
            { value: 'outlook', label: 'Outlook (web)' },
          ]}
          onChange={(e) => update({ mailProvider: e.target.value })}
        />

        <div className="flex flex-col gap-2 rounded-md border border-dashed border-tertiary bg-background-primary p-4">
          <p className="font-sans text-sm font-medium text-text-primary">Welcome package</p>
          <p className="font-sans text-sm text-text-secondary">
            Send this once when you ask someone to be your buddy. It explains the whole Odyssey — what
            it is, what they’ll receive, what’s asked of them, and how to read your notes — so the
            daily and weekly emails can stay short. It copies the note to your clipboard and opens your
            email; paste to drop it in.
          </p>
          <div className="pt-1">
            <BuddyEmailButton
              email={buddyWelcomeEmail(form.buddyName, form.userName)}
              to={form.buddyEmail}
              inSettings
              label="Copy the welcome package & open email"
            />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-tertiary bg-background-secondary p-6">
        <h3 className="font-display text-lg">Appearance</h3>
        <p className="font-sans text-sm text-text-secondary">
          Pick a palette — four light, four dark. The header{' '}
          <span className="font-medium text-text-primary">◐</span> button cycles through them in
          order, and the field guide follows your choice.
        </p>
        <ThemePicker preset={preset} setPreset={setPreset} />
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-tertiary bg-background-secondary p-6">
        <h3 className="font-display text-lg">New Odysseys</h3>
        <Select
          label="Default start day"
          hint="What a new Charter's Day 1 defaults to (you can always change it in the wizard)."
          value={settings.defaultStart}
          options={[
            { value: 'today', label: 'Today' },
            { value: 'mon', label: 'Next Monday' },
            { value: 'tue', label: 'Next Tuesday' },
            { value: 'wed', label: 'Next Wednesday' },
            { value: 'thu', label: 'Next Thursday' },
            { value: 'fri', label: 'Next Friday' },
            { value: 'sat', label: 'Next Saturday' },
            { value: 'sun', label: 'Next Sunday' },
          ]}
          onChange={(e) => update({ defaultStart: e.target.value })}
        />
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
        <h3 className="font-display text-lg">State check-in (optional)</h3>
        <p className="font-sans text-sm text-text-secondary">
          A private, thirty-second moment on Today to name what's here before you log — nothing
          about it is saved anywhere, in the app or in Notion.
        </p>
        <Switch
          label="Show the state check-in on Today"
          description="A short, on-device-only ritual above the daily check-in. Off by default."
          checked={settings.stateCheckinEnabled}
          onCheckedChange={(v) => update({ stateCheckinEnabled: v })}
        />
        <SupportingNote note="stateCheckin" />
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
        <SupportingNote note="aiCompanion" />
      </section>

      <section className="flex flex-col gap-4 rounded-lg border border-tertiary bg-background-secondary p-6">
        <h3 className="font-display text-lg select-none" onClick={handleReminderHeadingTap}>Reminders (optional)</h3>
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
        {settings.remindersEnabled && (
          <div className="flex flex-col gap-3 border-l-2 border-tertiary pl-4">
            <Switch label="Daily check-in" checked={settings.remindersDaily} onCheckedChange={(v) => update({ remindersDaily: v })} />
            <Switch label="Weekly reflection" checked={settings.remindersWeekly} onCheckedChange={(v) => update({ remindersWeekly: v })} />
            <Switch label="A planned Odyssey’s start" checked={settings.remindersStart} onCheckedChange={(v) => update({ remindersStart: v })} />
            <Switch label="Reaching the summit (harvest)" checked={settings.remindersHarvest} onCheckedChange={(v) => update({ remindersHarvest: v })} />
          </div>
        )}
        <p className="font-sans text-xs text-text-secondary">
          {caps.supported
            ? 'Background reminders work best in an installed app on Android or desktop Chrome. On iPhone they can’t run in the background — you’ll still see reminders inside the app.'
            : 'This browser can’t run background reminders — you’ll still see them inside the app when you open it.'}
        </p>
        {settings.remindersEnabled && notificationPermission() === 'denied' && (
          <p className="font-sans text-sm text-caution">
            Notifications are blocked in your browser — reminders can’t show until you allow them in
            your browser’s site settings.
          </p>
        )}
        {settings.remindersEnabled && parseDailyTime(form.dailyTime) == null && (
          <p className="font-sans text-sm text-caution">
            Set a <strong>Daily check-in time</strong> above for the daily reminder to fire.
          </p>
        )}
        {settings.remindersEnabled && form.weeklySlot.trim() && !parseWeeklySlot(form.weeklySlot) && (
          <p className="font-sans text-sm text-caution">
            Pick <strong>both a day and a time</strong> for the weekly call slot so the weekly reminder
            can fire.
          </p>
        )}
        {reminderMsg && <p className="font-sans text-sm text-caution">{reminderMsg}</p>}
        {reminderDiag && (
          <div className="flex flex-col gap-1 rounded-lg border border-tertiary bg-background-primary p-4 font-mono text-xs text-text-secondary">
            <p>permission: {reminderDiag.permission}</p>
            <p>periodicSync: {reminderDiag.periodicSyncTags.length ? reminderDiag.periodicSyncTags.join(', ') : 'not registered'}</p>
            <p>state: {reminderDiag.values.state ? JSON.stringify(reminderDiag.values.state) : 'none'}</p>
            <p>lastDailySent: {String(reminderDiag.values.lastDailySent ?? '—')}</p>
            <p>lastWeeklySent: {String(reminderDiag.values.lastWeeklySent ?? '—')}</p>
            <p>lastStartSent: {String(reminderDiag.values.lastStartSent ?? '—')}</p>
            <p>lastHarvestSent: {String(reminderDiag.values.lastHarvestSent ?? '—')}</p>
          </div>
        )}
        <SupportingNote note="reminders" />
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-tertiary bg-background-secondary p-6">
        <h3 className="font-display text-lg">This device</h3>
        <p className="font-sans text-sm text-text-secondary">
          Everything above is stored only in this browser. Clearing it removes your token, keys, and
          buddy from this device — your Notion records are untouched.
        </p>
        <div>
          <Button variant="secondary" onClick={() => setClearing(true)}>
            <Trash2 size={18} aria-hidden />
            Clear data on this device
          </Button>
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-3">
        <Button onClick={handleSave}>
          <Save size={18} aria-hidden />
          Save to this device
        </Button>
        {saved && <span className="font-sans text-sm text-text-secondary">Saved.</span>}
      </section>

      <Modal open={clearing} onClose={() => setClearing(false)} title="Clear data on this device?">
        <p className="font-sans text-sm text-text-secondary">
          This removes your Notion token, any keys, and your buddy from <strong>this browser</strong>.
          Your Notion records aren’t touched — re-enter your details anytime to reconnect.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setClearing(false)}>
            Keep it
          </Button>
          <Button
            onClick={() => {
              clearSettings()
              reload()
              setClearing(false)
              navigate('/')
            }}
          >
            <Trash2 size={18} aria-hidden />
            Clear
          </Button>
        </div>
      </Modal>
    </div>
  )
}

/** The palette picker — four light + four dark presets, each a live swatch. The swatch dots are the
 *  one place raw hex is legitimate (a colour preview OF the palette, sourced centrally from PRESETS),
 *  the same way a colour picker must show its colours. */
function ThemePicker({ preset, setPreset }: { preset: PresetId; setPreset: (id: PresetId) => void }) {
  return (
    <div className="flex flex-col gap-4">
      {(['light', 'dark'] as const).map((mode) => (
        <div key={mode} className="flex flex-col gap-2">
          <p className="font-mono text-xs uppercase tracking-wider text-text-secondary">{mode}</p>
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.filter((p) => p.mode === mode).map((p) => {
              const selected = p.id === preset
              const [canvas, accent, text] = p.swatch
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPreset(p.id)}
                  aria-pressed={selected}
                  className={cn(
                    'flex items-center gap-3 rounded-md border p-2.5 text-left transition-colors duration-fast',
                    selected
                      ? 'border-accent bg-accent-soft ring-1 ring-accent'
                      : 'border-secondary bg-background-primary hover:border-primary',
                  )}
                >
                  <span
                    aria-hidden
                    className="flex h-8 w-8 flex-none items-center justify-center gap-0.5 rounded border border-tertiary"
                    style={{ background: canvas }}
                  >
                    <span className="h-3.5 w-3.5 rounded-full" style={{ background: accent }} />
                    <span className="h-3.5 w-3.5 rounded-full" style={{ background: text }} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-sans text-sm font-medium text-text-primary">
                      {p.name}
                    </span>
                  </span>
                  {selected && <CheckCircle2 size={16} aria-hidden className="flex-none text-accent" />}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
