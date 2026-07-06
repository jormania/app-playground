import { Download } from 'lucide-react'
import { Button } from '../components/Button'
import { Notice } from '../components/Notice'
import { useSettings } from '../lib/settingsContext'
import { isConfigured } from '../lib/settings'
import { useOdysseyArchive } from '../lib/useOdysseyArchive'
import { isHarvested } from '../lib/harvest'
import { downloadSynopsis } from '../lib/exportSynopsis'
import { identitySentence } from '../lib/charter'
import type { OdysseyDetail } from '../lib/notion'

// The look-back. Identity-led — who you've become across the completed Odysseys, the method's real
// cargo. Purely qualitative: no dates, no streaks, no scores, no blame. A "Save as a page" export
// at the foot lets you take the same synopsis with you.
export function StatsPage({ navigate }: { navigate: (to: string) => void }) {
  const { settings } = useSettings()
  const archive = useOdysseyArchive()

  if (!isConfigured(settings)) {
    return <Notice title="Connect Notion first" body="Add your token and database links in Settings." actionLabel="Open Settings" onAction={() => navigate('/settings')} />
  }
  if (archive.isPending) return <p className="font-sans text-text-secondary">Loading…</p>
  if (archive.isError) {
    return <Notice title="Couldn’t load your Odysseys" body={archive.error.message} actionLabel="Open Settings" onAction={() => navigate('/settings')} />
  }

  // Only completed (harvested) Odysseys — in-flight and not-yet-started ones are ignored here.
  const past = (archive.data ?? []).filter((o) => isHarvested(o.status))

  if (past.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <StatHeader count={0} />
        <Notice
          titleAs="h3"
          title="Nothing here yet"
          body="When you complete your first Odyssey, who you became will gather here — the identity you grew, what you practised, and why it mattered."
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <StatHeader count={past.length} />

      <div className="flex flex-col gap-3">
        {past.map((o) => (
          <BecomeCard key={o.id} odyssey={o} />
        ))}
      </div>

      <div>
        <Button variant="secondary" onClick={() => downloadSynopsis(past)}>
          <Download size={18} aria-hidden />
          Save as a page
        </Button>
        <p className="mt-2 font-sans text-sm text-text-secondary">
          A self-contained HTML keepsake of these journeys — yours to keep, print, or share.
        </p>
      </div>
    </div>
  )
}

function StatHeader({ count }: { count: number }) {
  return (
    <header className="flex flex-col gap-1">
      <span className="font-mono text-xs uppercase tracking-wide text-accent">Looking back</span>
      <h2 className="font-display text-2xl">Who you’ve become</h2>
      {count > 0 && (
        <p className="font-sans text-text-secondary">
          {count} {count === 1 ? 'Odyssey' : 'Odysseys'} practised into being.
        </p>
      )}
    </header>
  )
}

/** One completed Odyssey, identity first. */
function BecomeCard({ odyssey }: { odyssey: OdysseyDetail }) {
  const identity = odyssey.identity.trim() ? identitySentence(odyssey.identity) : odyssey.behaviour.trim()
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-tertiary bg-background-secondary p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="font-mono text-xs uppercase tracking-wide text-text-secondary">{odyssey.title}</span>
        <OutcomeTag value={odyssey.outcome || odyssey.status} />
      </div>
      {identity && <p className="font-display text-xl italic leading-snug">{identity}</p>}
      <dl className="flex flex-col gap-3">
        <Line label="Practised" value={odyssey.tinyVersion || odyssey.behaviour} />
        <Line label="Why it mattered" value={odyssey.whyValue} />
        <Line label="What installed" value={odyssey.notes} />
      </dl>
    </article>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-xs uppercase tracking-wide text-text-secondary">{label}</span>
      <p className="font-sans text-text-primary">{value}</p>
    </div>
  )
}

/** A quiet descriptive pill — what you decided, never a verdict on you. */
function OutcomeTag({ value }: { value: string }) {
  if (!value) return null
  return (
    <span className="shrink-0 rounded-pill bg-accent-soft px-2.5 py-0.5 font-mono text-xs text-accent">
      {value}
    </span>
  )
}
