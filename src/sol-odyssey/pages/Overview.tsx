import { useActiveOdysseys } from '../lib/useActiveOdysseys'
import { useNextOdysseyNumber } from '../lib/useNextOdysseyNumber'
import { useSettings } from '../lib/settingsContext'
import { computeDayIndex, CYCLE_DAYS } from '../lib/charter'
import { isConfigured } from '../lib/settings'
import { Notice } from '../components/Notice'
import { Button } from '../components/Button'
import { Sprout } from 'lucide-react'
import type { OdysseyDetail } from '../lib/notion'

/** Home when an Odyssey is Active: a calm, read-only charter readout — the seed of the spec's
 *  "Odyssey overview" screen. The daily loop / tracker arrive in M3. */
export function OverviewPage({ navigate }: { navigate: (to: string) => void }) {
  const { settings } = useSettings()
  const active = useActiveOdysseys()
  const history = useNextOdysseyNumber()

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
  if (active.isPending) {
    return <p className="font-sans text-text-secondary">Loading your Odyssey…</p>
  }
  if (active.isError) {
    return (
      <Notice title="Couldn’t load your Odyssey" body={active.error.message} actionLabel="Open Settings" onAction={() => navigate('/settings')} />
    )
  }
  if (!active.data || active.data.length === 0) {
    const hasPrior = history.data?.hasPrior ?? false
    const nextNumber = history.data?.nextNumber ?? 1
    return (
      <Notice
        title="No Odyssey under way"
        body={
          hasPrior
            ? 'Your last Odyssey is closed out. Begin the next when you’re ready.'
            : 'When you’re ready, write a charter and begin your first six-week Odyssey.'
        }
        actionLabel={hasPrior ? `Begin Odyssey ${nextNumber}` : 'Start your first Odyssey'}
        onAction={() => navigate('/charter')}
      />
    )
  }

  return <OdysseyReadout odyssey={active.data[0]} navigate={navigate} />
}

function OdysseyReadout({ odyssey, navigate }: { odyssey: OdysseyDetail; navigate: (to: string) => void }) {
  const day = odyssey.startDate ? computeDayIndex(odyssey.startDate) : null
  const dayLabel =
    day == null ? '' : day < 1 ? `Starts in ${1 - day} day(s)` : `Day ${Math.min(day, CYCLE_DAYS)} of ${CYCLE_DAYS}`

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <span className="font-mono text-xs uppercase tracking-wide text-accent">{dayLabel}</span>
        <h2 className="font-display text-2xl">{odyssey.title}</h2>
        {odyssey.identity && (
          <p className="font-display text-lg text-text-secondary">{odyssey.identity}</p>
        )}
      </header>

      <dl className="grid gap-3">
        <Readout label="Tiny version" value={odyssey.tinyVersion} />
        <Readout label="Anchor" value={odyssey.anchor} />
        <Readout label="If-then" value={odyssey.ifThen} />
        <Readout label="Daily success" value={odyssey.dailySuccess} />
        <Readout label="Why it matters" value={odyssey.whyValue} />
        {odyssey.startDate && (
          <Readout label="Runs" value={`${odyssey.startDate} → ${odyssey.endDate} · 42 days`} />
        )}
      </dl>

      <p className="font-sans text-sm text-text-secondary">
        Your charter at a glance — it governs the whole six weeks.
      </p>

      {/* One prominent, clearly-labelled close-out — the same Harvest flow in every phase. */}
      <div className="flex flex-col gap-3 rounded-lg border border-border-primary bg-background-secondary p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-0.5">
          <h3 className="font-display text-lg">Harvest this Odyssey</h3>
          <p className="font-sans text-sm text-text-secondary">
            When you’re ready to close out — name what installed, then keep · grow · retire.
          </p>
        </div>
        <Button onClick={() => navigate('/harvest')} className="shrink-0">
          <Sprout size={18} aria-hidden />
          Harvest
        </Button>
      </div>
    </div>
  )
}

function Readout({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-tertiary bg-background-secondary p-4">
      <dt className="font-mono text-xs uppercase tracking-wide text-text-secondary">{label}</dt>
      <dd className="font-sans text-text-primary">{value}</dd>
    </div>
  )
}
