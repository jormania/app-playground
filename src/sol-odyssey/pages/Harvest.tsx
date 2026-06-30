import { useState } from 'react'
import { ArrowRight, Check, Loader2, MessageCircleHeart, Sprout } from 'lucide-react'
import { Button } from '../components/Button'
import { Textarea } from '../components/Textarea'
import { Notice } from '../components/Notice'
import { Modal } from '../components/Modal'
import { SupportingNote } from '../components/SupportingNote'
import { CompanionPanel } from '../components/CompanionPanel'
import { BuddyEmailButton } from '../components/BuddyEmailButton'
import { harvestBuddyMail } from '../lib/buddyMail'
import { cn } from '../lib/cn'
import { useSettings } from '../lib/settingsContext'
import { isConfigured, companionActive } from '../lib/settings'
import { useActiveOdysseys, useHarvestOdyssey } from '../lib/useActiveOdysseys'
import { OUTCOME_OPTIONS, statusForOutcome, type Outcome } from '../lib/harvest'
import { buildHarvestCompanionPrompt } from '../lib/companion'

export function HarvestPage({ navigate }: { navigate: (to: string) => void }) {
  const { settings } = useSettings()
  const active = useActiveOdysseys()
  const odyssey = active.data?.[0]
  const harvest = useHarvestOdyssey()

  const [verdict, setVerdict] = useState('')
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [confirming, setConfirming] = useState(false)

  if (!isConfigured(settings)) {
    return <Notice title="Connect Notion first" body="Add your token and database links in Settings." actionLabel="Open Settings" onAction={() => navigate('/settings')} />
  }
  if (active.isPending) return <p className="font-sans text-text-secondary">Loading…</p>
  if (!odyssey && !harvest.isSuccess) {
    return <Notice title="No Odyssey to harvest" body="Harvest closes out an active Odyssey. Start one first." actionLabel="Start an Odyssey" onAction={() => navigate('/charter')} />
  }

  // ── After harvest: the handover ──
  if (harvest.isSuccess) {
    const chosen = harvest.data
    // Each outcome gets its own note — all three are valued, and each is different.
    const outcomeNote =
      chosen.status === 'Completed' ? 'harvestGrow' : chosen.status === 'Retired' ? 'harvestRetire' : 'harvestKeep'
    return (
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <span className="font-mono text-xs uppercase tracking-wide text-accent">Harvested · {chosen.status}</span>
          <h2 className="font-display text-2xl">{chosen.title}</h2>
        </header>
        <Notice
          title="You descend with a method, not just a habit"
          body={
            chosen.status === 'Maintenance'
              ? 'Kept at its tiny floor as maintenance — installed, low-effort, alive. It no longer counts as your active Odyssey, so you’re free to begin the next.'
              : chosen.status === 'Retired'
                ? 'Retired — it served its purpose, taught you what it had to, and you let it go cleanly. The way is clear for the next Odyssey.'
                : 'Completed — these six weeks did their work. Carry the behaviour forward, larger, in the next Odyssey.'
          }
        />
        <SupportingNote note={outcomeNote} />
        <SupportingNote note="compounding" />
        <div className="flex flex-wrap items-center gap-3">
          <BuddyEmailButton email={harvestBuddyMail(settings.buddyName, settings.userName, chosen)} navigate={navigate} />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => navigate('/charter')}>
            <Sprout size={18} aria-hidden />
            Begin your next Odyssey
          </Button>
          <Button variant="ghost" onClick={() => navigate('/')}>
            Back home
          </Button>
        </div>
      </div>
    )
  }

  function submit() {
    if (!odyssey || !outcome) return
    harvest.mutate({ odysseyId: odyssey.id, outcome, verdict })
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <span className="font-mono text-xs uppercase tracking-wide text-accent">Harvest</span>
        <h2 className="font-display text-2xl">Name what installed. Choose what’s next.</h2>
      </header>

      <section className="flex flex-col gap-2 rounded-lg border border-tertiary bg-background-secondary p-5">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-lg text-accent">1</span>
          <h3 className="font-display text-lg">Name what installed</h3>
        </div>
        <Textarea
          label="What does the behaviour feel like now — automatic, half-there, still effortful?"
          required
          rows={3}
          value={verdict}
          onChange={(e) => setVerdict(e.target.value)}
        />
        <div className="mt-1"><SupportingNote note="harvest" /></div>
      </section>

      {/* Optional reflective companion on what installed — appears once you've written the verdict. */}
      {odyssey && companionActive(settings) &&
        (verdict.trim() ? (
          <CompanionPanel prompt={buildHarvestCompanionPrompt(odyssey, verdict)} />
        ) : (
          <p className="flex items-center gap-2 rounded-md border border-accent/20 bg-accent-soft px-4 py-3 font-sans text-sm text-text-secondary">
            <MessageCircleHeart size={16} className="shrink-0 text-accent" aria-hidden />
            Write what installed above, then your companion can reflect on it with you.
          </p>
        ))}

      <section className="flex flex-col gap-3 rounded-lg border border-tertiary bg-background-secondary p-5">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-lg text-accent">2</span>
          <h3 className="font-display text-lg">Keep · Grow · Retire</h3>
        </div>
        <div className="flex flex-col gap-2">
          {OUTCOME_OPTIONS.map((opt) => {
            const on = outcome === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={on}
                onClick={() => setOutcome(opt.value)}
                className={cn(
                  'flex flex-col gap-0.5 rounded-md border p-4 text-left transition-colors duration-fast',
                  on ? 'border-accent bg-accent-soft' : 'border-secondary bg-background-primary hover:bg-background-tertiary',
                )}
              >
                <span className="flex items-center gap-2 font-sans font-medium text-text-primary">
                  {on && <Check size={15} className="text-accent" aria-hidden />}
                  {opt.title}
                  <span className="font-mono text-xs font-normal text-text-secondary">→ {statusForOutcome(opt.value)}</span>
                </span>
                <span className="font-sans text-sm text-text-secondary">{opt.description}</span>
              </button>
            )
          })}
        </div>
        <div className="mt-1"><SupportingNote note="keepGrowRetire" /></div>
      </section>

      <div className="flex items-center gap-3">
        <Button onClick={() => setConfirming(true)} disabled={!outcome || !verdict.trim() || harvest.isPending}>
          {harvest.isPending ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <ArrowRight size={18} aria-hidden />}
          Harvest this Odyssey
        </Button>
        <Button variant="ghost" onClick={() => navigate('/overview')}>
          Not yet
        </Button>
      </div>

      {harvest.isError && <p role="alert" className="font-sans text-sm text-caution">{harvest.error.message}</p>}

      <Modal open={confirming} onClose={() => setConfirming(false)} title="Close out this Odyssey?">
        <p className="font-sans text-sm text-text-primary">
          This sets <strong>{odyssey?.title}</strong> to{' '}
          <strong>{outcome ? statusForOutcome(outcome) : ''}</strong> and ends the active cycle. It
          can’t be undone in the app.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <Button
            onClick={() => {
              setConfirming(false)
              submit()
            }}
          >
            Yes, harvest
          </Button>
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      </Modal>
    </div>
  )
}
