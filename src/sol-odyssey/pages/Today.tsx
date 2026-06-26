import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, MessageCircleHeart, NotebookPen, PartyPopper, Save, Sprout } from 'lucide-react'
import { ActionPrompt } from '../components/ActionPrompt'
import { Button } from '../components/Button'
import { Switch } from '../components/Switch'
import { Textarea } from '../components/Textarea'
import { Notice } from '../components/Notice'
import { SupportingNote } from '../components/SupportingNote'
import { useSettings } from '../lib/settingsContext'
import { isConfigured, companionActive } from '../lib/settings'
import { CompanionPanel } from '../components/CompanionPanel'
import { CommitmentCard } from '../components/CommitmentCard'
import { BuddyEmailButton } from '../components/BuddyEmailButton'
import { buildDailyCompanionPrompt, buildLapseCompanionPrompt } from '../lib/companion'
import { dailyBuddyMail, kickoffBuddyMail } from '../lib/buddyMail'
import { useActiveOdysseys } from '../lib/useActiveOdysseys'
import { useNextOdysseyNumber } from '../lib/useNextOdysseyNumber'
import { usePlanningOdyssey } from '../lib/usePlanningOdyssey'
import { PlannedOdysseyCard, PlannedOdysseyStrip } from '../components/PlannedOdyssey'
import { useCheckins, useUpsertCheckin } from '../lib/useCheckins'
import { useReflections } from '../lib/useReflections'
import { CYCLE_DAYS, todayISO } from '../lib/charter'
import { canSaveCheckin, checkinErrors, cycleState, forfeitDue, shouldWarnDontSkipTwice, EMPTY_CHECKIN, type CheckinDraft } from '../lib/checkins'
import { reflectableWeeks } from '../lib/reflections'

export function TodayPage({ navigate }: { navigate: (to: string) => void }) {
  const { settings } = useSettings()
  const active = useActiveOdysseys()
  const odyssey = active.data?.[0]
  const planning = usePlanningOdyssey()
  const draft = planning.data ?? null
  const checkins = useCheckins(odyssey?.id)
  const reflections = useReflections(odyssey?.id)
  const history = useNextOdysseyNumber()
  const upsert = useUpsertCheckin(odyssey?.id)

  const today = todayISO()
  const todayRecord = checkins.data?.find((r) => r.date === today)

  const [form, setForm] = useState<CheckinDraft>(EMPTY_CHECKIN)
  const [celebrate, setCelebrate] = useState(false)

  // Seed the form from today's saved check-in on load / after a save (keyed on its id so we
  // don't clobber what the user is typing between refetches).
  useEffect(() => {
    if (todayRecord) {
      setForm({
        done: todayRecord.done,
        oneLine: todayRecord.oneLine,
        friction: todayRecord.friction,
        sentToBuddy: todayRecord.sentToBuddy,
      })
    } else {
      setForm(EMPTY_CHECKIN)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [odyssey?.id, todayRecord?.id])

  if (!isConfigured(settings)) {
    return (
      <Notice
        title="Connect Notion first"
        body="Add your token and database links so Sol Odyssey can hold your Odyssey."
        actionLabel="Open Settings"
        onAction={() => navigate('/settings')}
      />
    )
  }
  if (active.isPending) return <p className="font-sans text-text-secondary">Loading…</p>
  if (active.isError) {
    return <Notice title="Couldn’t load your Odyssey" body={active.error.message} actionLabel="Open Settings" onAction={() => navigate('/settings')} />
  }
  if (!odyssey) {
    // A draft is prepared but nothing is running yet → offer to begin/edit it.
    if (draft) return <PlannedOdysseyCard draft={draft} navigate={navigate} />
    const hasPrior = history.data?.hasPrior ?? false
    const nextNumber = history.data?.nextNumber ?? 1
    return (
      <Notice
        title="No Odyssey under way"
        body={
          hasPrior
            ? 'Your last Odyssey is closed out. When you’re ready, point the same machine at the next thing.'
            : 'When you’re ready, write a charter and begin your first six-week Odyssey.'
        }
        actionLabel={hasPrior ? `Begin Odyssey ${nextNumber}` : 'Start your first Odyssey'}
        onAction={() => navigate('/charter')}
      />
    )
  }

  const cycle = odyssey.startDate ? cycleState(odyssey.startDate) : null
  const weekday = new Date(`${today}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long' })

  // ── Pre-start ──
  if (cycle?.phase === 'before') {
    return (
      <div className="flex flex-col gap-6">
        <Header title={odyssey.title} sub={`Starts in ${cycle.daysUntilStart} day${cycle.daysUntilStart === 1 ? '' : 's'} · ${odyssey.startDate}`} />
        <Notice
          titleAs="h3"
          title="Not yet — and that’s right"
          body="Your Odyssey hasn’t begun. Rig the system, tell your buddy, and rest until Day 1. The departure is fixed; nothing to perform yet."
        />
        {odyssey.tinyVersion && <TinyReminder value={odyssey.tinyVersion} />}
        <div className="flex flex-wrap items-center gap-3">
          <BuddyEmailButton mail={kickoffBuddyMail(settings.buddyName, odyssey)} navigate={navigate} />
        </div>
        <CommitmentCard odyssey={odyssey} cycleActive={false} />
      </div>
    )
  }

  // ── Past day 42 ──
  if (cycle?.phase === 'after') {
    return (
      <div className="flex flex-col gap-6">
        <Header title={odyssey.title} sub="Your 42 days are complete" />
        <Notice
          titleAs="h3"
          title="You reached the summit"
          body="The cycle is done. Harvest what installed — name it, decide keep / grow / retire — and choose what comes next."
          actionLabel="Harvest this Odyssey"
          onAction={() => navigate('/harvest')}
        />
        {draft && <PlannedOdysseyStrip draft={draft} navigate={navigate} />}
      </div>
    )
  }

  // ── Active day ──
  const dayIndex = cycle?.dayIndex ?? 1
  const pendingWeek = reflectableWeeks(dayIndex).find(
    (w) => !(reflections.data?.some((r) => r.weekIndex === w)),
  )

  // Surface the forfeit-on-lapse contract where it bites: when the line is crossed (two missed
  // days), and — preventively — when a single gap has opened. Only when a contract is set.
  const records = checkins.data ?? []
  const hasContract = odyssey.commitment.trim().length > 0
  const lapseCrossed = hasContract && forfeitDue(records, today)
  const oneGap = hasContract && !lapseCrossed && shouldWarnDontSkipTwice(records, today)

  function save() {
    const wasDone = todayRecord?.done ?? false
    upsert.mutate(
      {
        odysseyId: odyssey!.id,
        odysseyNumber: odyssey!.number ?? 1,
        dateISO: today,
        dayIndex,
        existingId: todayRecord?.id,
        draft: form,
      },
      {
        onSuccess: () => {
          if (form.done && !wasDone) {
            setCelebrate(true)
            window.setTimeout(() => setCelebrate(false), 2400)
          }
        },
      },
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Header title={odyssey.title} sub={`Day ${dayIndex} of ${CYCLE_DAYS} · ${weekday}`} />

      {dayIndex >= CYCLE_DAYS && (
        <ActionPrompt variant="solid" icon={Sprout} cta="Harvest" onAction={() => navigate('/harvest')}>
          You’ve reached the summit — name what installed and choose what’s next.
        </ActionPrompt>
      )}

      {celebrate && (
        <div className="sol-celebrate flex items-center gap-2 rounded-md border border-energy/40 bg-accent-soft p-4">
          <PartyPopper size={20} className="text-energy" aria-hidden />
          <p className="font-sans text-sm font-medium text-text-primary">Day {dayIndex}, done. That’s the whole job today.</p>
        </div>
      )}

      {pendingWeek && (
        <ActionPrompt icon={NotebookPen} cta="Reflect" onAction={() => navigate('/weekly')}>
          Week {pendingWeek} is complete — time to reflect and adjust.
        </ActionPrompt>
      )}

      {/* The forfeit-on-lapse contract, surfaced where it bites. */}
      {lapseCrossed && (
        <div role="status" className="flex flex-col gap-2 rounded-md border border-caution/40 bg-background-secondary p-4">
          <p className="font-sans text-sm font-medium text-text-primary">
            The line you drew has been crossed — two days missed.
          </p>
          <p className="font-sans text-sm text-text-secondary">
            Honour what you pledged, tell your buddy, and rejoin today. No shame — just the next turn.
          </p>
          <p className="rounded-md border-l-2 border-caution/50 bg-background-primary px-3 py-2 font-sans text-sm text-text-primary">
            “{odyssey.commitment}”
          </p>
          {companionActive(settings) && (
            <CompanionPanel prompt={buildLapseCompanionPrompt(odyssey, odyssey.commitment)} />
          )}
        </div>
      )}
      {oneGap && (
        <div role="status" className="rounded-md border border-caution/40 bg-background-secondary p-4">
          <p className="font-sans text-sm text-text-primary">
            A day slipped — close the gap before a second forms. You set this line:{' '}
            <span className="font-medium">“{odyssey.commitment}”</span>. Don’t let it come due — do the
            tiny version now.
          </p>
        </div>
      )}

      {odyssey.tinyVersion && <TinyReminder value={odyssey.tinyVersion} />}

      <section className="flex flex-col gap-5 rounded-lg border border-tertiary bg-background-secondary p-6">
        <Switch
          label="I did the tiny version today"
          description="Done counts. Perfect is irrelevant."
          checked={form.done}
          onCheckedChange={(v) => setForm((f) => ({ ...f, done: v }))}
        />
        <div className="flex flex-col gap-1">
          <Textarea
            label="One line"
            required
            placeholder="What happened, or what you noticed."
            rows={2}
            value={form.oneLine}
            onChange={(e) => setForm((f) => ({ ...f, oneLine: e.target.value }))}
          />
          {checkinErrors(form).oneLine && (
            <p className="font-sans text-sm text-caution">{checkinErrors(form).oneLine}</p>
          )}
        </div>
        <Textarea
          label="Friction (optional)"
          placeholder="What got in the way, if anything."
          rows={2}
          value={form.friction}
          onChange={(e) => setForm((f) => ({ ...f, friction: e.target.value }))}
        />
        <div className="flex flex-col gap-3">
          <Switch
            label="Sent to my buddy"
            description="A self-marked note that you reached out — the app sends nothing."
            checked={form.sentToBuddy}
            onCheckedChange={(v) => setForm((f) => ({ ...f, sentToBuddy: v }))}
          />
          <div className="flex flex-wrap items-center gap-3">
            <BuddyEmailButton
              mail={dailyBuddyMail(settings.buddyName, odyssey, form, dayIndex)}
              navigate={navigate}
            />
          </div>
        </div>
        <SupportingNote note="selfMonitor" />
        <SupportingNote note="sentToBuddy" />

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={save} disabled={!canSaveCheckin(form) || upsert.isPending}>
            {upsert.isPending ? (
              <Loader2 size={18} className="animate-spin" aria-hidden />
            ) : todayRecord ? (
              <CheckCircle2 size={18} aria-hidden />
            ) : (
              <Save size={18} aria-hidden />
            )}
            {todayRecord ? 'Update today' : 'Save today'}
          </Button>
          {upsert.isSuccess && !upsert.isPending && (
            <span className="font-sans text-sm text-text-secondary">
              {upsert.data?.queued ? 'Saved · will sync' : 'Saved.'}
            </span>
          )}
        </div>

        {upsert.isError && (
          <p role="alert" className="font-sans text-sm text-caution">
            {upsert.error.message}
          </p>
        )}
      </section>

      {/* Optional reflective companion — appears once today's check-in has words to reflect on; a
          quiet hint before that so it's discoverable. */}
      {companionActive(settings) &&
        (todayRecord?.oneLine?.trim() ? (
          <CompanionPanel prompt={buildDailyCompanionPrompt(odyssey, todayRecord)} />
        ) : (
          <p className="flex items-center gap-2 rounded-md border border-accent/20 bg-accent-soft px-4 py-3 font-sans text-sm text-text-secondary">
            <MessageCircleHeart size={16} className="shrink-0 text-accent" aria-hidden />
            Log today’s check-in above, then your companion can reflect on it here.
          </p>
        ))}

      {draft && <PlannedOdysseyStrip draft={draft} navigate={navigate} />}
    </div>
  )
}

function Header({ title, sub }: { title: string; sub: string }) {
  return (
    <header className="flex flex-col gap-1">
      <span className="font-mono text-xs uppercase tracking-wide text-accent">{sub}</span>
      <h2 className="font-display text-2xl">{title}</h2>
    </header>
  )
}

function TinyReminder({ value }: { value: string }) {
  return (
    <div className="rounded-md border border-tertiary bg-background-secondary p-4">
      <p className="font-mono text-xs uppercase tracking-wide text-text-secondary">Today’s tiny version</p>
      <p className="mt-1 font-sans text-text-primary">{value}</p>
    </div>
  )
}

