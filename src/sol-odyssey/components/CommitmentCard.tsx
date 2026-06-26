import { useState } from 'react'
import { Anchor, CheckCircle2, Loader2, Save } from 'lucide-react'
import { Button } from './Button'
import { Textarea } from './Textarea'
import { CompanionPanel } from './CompanionPanel'
import { SupportingNote } from './SupportingNote'
import { useWriteCommitment } from '../lib/useCommitment'
import { useSettings } from '../lib/settingsContext'
import { companionActive } from '../lib/settings'
import { buildContractCompanionPrompt } from '../lib/companion'
import type { OdysseyDetail } from '../lib/notion'

/** Set or edit the optional forfeit-on-lapse contract — a self-chosen consequence for missing two
 *  days running. The app holds your word and shows it back at the wobble; it enforces nothing. */
export function CommitmentCard({
  odyssey,
  cycleActive,
}: {
  odyssey: OdysseyDetail
  cycleActive: boolean
}) {
  const { settings } = useSettings()
  const [text, setText] = useState(odyssey.commitment)
  const write = useWriteCommitment()
  const dirty = text.trim() !== odyssey.commitment.trim()

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-tertiary bg-background-secondary p-5">
      <header className="flex items-center gap-2">
        <Anchor size={18} className="text-accent" aria-hidden />
        <h3 className="font-display text-lg">Your safety line (optional)</h3>
      </header>
      <p className="font-sans text-sm text-text-secondary">
        A commitment device: name <strong>one consequence you’ll honour</strong> if you ever miss two
        days running. Sol Odyssey holds your word and shows it back the moment a gap opens — it
        enforces nothing; the keeping is yours (and your buddy’s).
      </p>

      <Textarea
        label="If I miss two days running, then…"
        placeholder="e.g. I donate £20 to a cause I dislike, and tell my buddy the same day."
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      {cycleActive && (
        <p className="font-sans text-xs text-text-secondary">
          Changing your safety line mid-Odyssey loosens it — set it before Day 1 and let it hold.
        </p>
      )}

      <SupportingNote note="commitmentDevice" />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          onClick={() => write.mutate({ odysseyId: odyssey.id, contract: text })}
          disabled={!dirty || write.isPending}
        >
          {write.isPending ? (
            <Loader2 size={18} className="animate-spin" aria-hidden />
          ) : write.isSuccess && !dirty ? (
            <CheckCircle2 size={18} aria-hidden />
          ) : (
            <Save size={18} aria-hidden />
          )}
          {odyssey.commitment.trim() ? 'Update safety line' : 'Set safety line'}
        </Button>
        {write.isSuccess && !dirty && (
          <span className="font-sans text-sm text-text-secondary">Saved.</span>
        )}
      </div>

      {write.isError && (
        <p role="alert" className="font-sans text-sm text-caution">
          {write.error.message}
        </p>
      )}

      {/* Optional in-role companion reflection on the forfeit you drafted. */}
      {companionActive(settings) && text.trim() && (
        <CompanionPanel prompt={buildContractCompanionPrompt(odyssey, text)} />
      )}
    </section>
  )
}
