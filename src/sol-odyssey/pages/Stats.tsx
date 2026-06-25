import { Notice } from '../components/Notice'
import { useSettings } from '../lib/settingsContext'
import { isConfigured } from '../lib/settings'
import { useOdysseyArchive } from '../lib/useOdysseyArchive'
import type { OdysseyDetail } from '../lib/notion'

// A light, non-judgemental record of the Odysseys behind you — what you practised and why it
// mattered. No durations, no scores, no pass/fail. The page is built from small reusable pieces
// (StatHeader, ArchiveCard, Line) so future stats views can compose the same parts.
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

  // "Past" = everything that's no longer the active run.
  const past = (archive.data ?? []).filter((o) => o.status !== 'Active')

  if (past.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <StatHeader count={0} />
        <Notice
          title="Nothing here yet"
          body="Your finished Odysseys will gather here — what you practised, and why it mattered. No durations, no scores; just the trail behind you."
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <StatHeader count={past.length} />
      <div className="flex flex-col gap-3">
        {past.map((o) => (
          <ArchiveCard key={o.id} odyssey={o} />
        ))}
      </div>
    </div>
  )
}

function StatHeader({ count }: { count: number }) {
  return (
    <header className="flex flex-col gap-1">
      <span className="font-mono text-xs uppercase tracking-wide text-accent">Stats</span>
      <h2 className="font-display text-2xl">Odysseys behind you</h2>
      {count > 0 && (
        <p className="font-sans text-text-secondary">
          {count} {count === 1 ? 'Odyssey' : 'Odysseys'} practised into being.
        </p>
      )}
    </header>
  )
}

/** One past Odyssey, lightly: what it was (tiny version) and why it mattered. */
function ArchiveCard({ odyssey }: { odyssey: OdysseyDetail }) {
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-tertiary bg-background-secondary p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-lg">{odyssey.title}</h3>
        {odyssey.status && <OutcomeTag status={odyssey.status} />}
      </div>
      <Line label="What it was" value={odyssey.tinyVersion || odyssey.behaviour} />
      <Line label="Why it mattered" value={odyssey.whyValue} />
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

/** A quiet status pill — descriptive, never a verdict. */
function OutcomeTag({ status }: { status: string }) {
  return (
    <span className="shrink-0 rounded-pill bg-accent-soft px-2.5 py-0.5 font-mono text-xs text-accent">
      {status}
    </span>
  )
}
