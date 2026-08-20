import { useState } from 'react'
import { Button, ConfirmModal } from '../../ds'
import { fadeRatio, daysRemaining, DEFAULT_SEASON_DAYS } from '../lib/understory'
import type { Thing } from '../lib/notion'
import { usePhotoUrl } from './usePhotoUrl'
import { useLinkPreview } from './useLinkPreview'
import styles from './NurseryView.module.css'

export interface NurseryViewProps {
  things: Thing[]
  onKeep: (id: string, note?: string) => void
  onRelease: (id: string) => void
  onDelete: (id: string) => void
  seasonDays?: number
}

/** Unkept arrivals, each shown with its remaining season as a fade rather
 *  than a countdown number (SILVA.md: "the understory... with their
 *  remaining season shown as a fade rather than a number"). */
export function NurseryView({ things, onKeep, onRelease, onDelete, seasonDays = DEFAULT_SEASON_DAYS }: NurseryViewProps) {
  // Why this, right when you decide it matters — SILVA.md's Keep → Annotate
  // step, without making Keep itself wait on it. Collapsed by default so the
  // one-tap keep nobody wants to slow down stays one tap; only a row you
  // deliberately open costs anything.
  const [openId, setOpenId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  if (things.length === 0) {
    return <p className={styles.empty}>The nursery is empty. Type or paste something to begin.</p>
  }

  return (
    <ul className={styles.list}>
      {things.map((thing) => (
        <NurseryRow
          key={thing.id}
          thing={thing}
          seasonDays={seasonDays}
          isOpen={openId === thing.id}
          draft={drafts[thing.id] ?? ''}
          onOpen={() => setOpenId(thing.id)}
          onDraftChange={(value) => setDrafts((prev) => ({ ...prev, [thing.id]: value }))}
          onKeep={() => {
            const note = drafts[thing.id]?.trim()
            onKeep(thing.id, note || undefined)
            setOpenId(null)
          }}
          onRelease={() => onRelease(thing.id)}
          onDelete={() => onDelete(thing.id)}
        />
      ))}
    </ul>
  )
}

function NurseryRow({
  thing,
  seasonDays,
  isOpen,
  draft,
  onOpen,
  onDraftChange,
  onKeep,
  onRelease,
  onDelete,
}: {
  thing: Thing
  seasonDays: number
  isOpen: boolean
  draft: string
  onOpen: () => void
  onDraftChange: (value: string) => void
  onKeep: () => void
  onRelease: () => void
  onDelete: () => void
}) {
  const fade = fadeRatio(thing, seasonDays)
  const remaining = Math.max(0, Math.ceil(daysRemaining(thing, seasonDays)))
  // SILVA.md: the remaining season is "shown as a fade rather than a
  // number" — "No badge, no counter". The countdown that used to sit
  // under every row was exactly the debt-clock the understory is
  // designed not to be. The number survives only as a title/label, for
  // anyone who deliberately asks (and for screen readers, which cannot
  // read an opacity).
  const seasonText = remaining > 0
    ? `${remaining} day${remaining === 1 ? '' : 's'} of this season left`
    : 'fading out of the nursery'

  const [confirmingDelete, setConfirmingDelete] = useState(false)

  // A photographed page's own thumbnail, or a link's Open Graph image —
  // whichever this thing actually has. Same small framed swatch either way
  // (see NurseryView.module.css's .thumb), so a photo and a link read as
  // the same *kind* of thing here, well before either is kept — you no
  // longer have to Keep an Image thing blind just to see what you
  // photographed.
  const photoSrc = usePhotoUrl(thing.image)
  const linkPreview = useLinkPreview(thing.link)
  const thumbSrc = photoSrc || linkPreview?.image || null
  // A photographed page whose transcription hasn't landed (or was skipped)
  // has an empty body — so with a decorative alt="" its row carried *no*
  // accessible content at all, just two unexplained buttons. SpecimenPlate
  // already names its photo this way; the nursery has to as well.
  const thumbAlt = thing.body
    ? ''
    : photoSrc
      ? 'A photographed page, not yet transcribed'
      : linkPreview?.title || ''

  return (
    <li
      className={styles.row}
      style={{ opacity: 0.4 + fade * 0.6 }}
      title={seasonText}
    >
      {thumbSrc && <img className={styles.thumb} src={thumbSrc} alt={thumbAlt} loading="lazy" />}
      <div className={styles.body}>
        {thing.kind && <span className={styles.kind}>{thing.kind}</span>}
        <p className={styles.text}>{thing.body}</p>
        <span
          className={styles.season}
          role="img"
          aria-label={seasonText}
          style={{ ['--season-left' as string]: `${Math.round(fade * 100)}%` }}
        />
        {isOpen ? (
          <textarea
            className={styles.whyInput}
            autoFocus
            rows={2}
            placeholder="Why this. What it rhymed with."
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
          />
        ) : (
          <button type="button" className={styles.whyToggle} onClick={onOpen}>
            + Why
          </button>
        )}
      </div>
      <div className={styles.actions}>
        <Button size="sm" variant="primary" onClick={onKeep}>
          Keep
        </Button>
        <Button size="sm" variant="ghost" onClick={onRelease}>
          Release
        </Button>
        {/* Below Release, and the only one that asks first — the column runs
         *  from the affirmative act down to the irreversible one. */}
        <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(true)}>
          Delete
        </Button>
      </div>
      <ConfirmModal
        isOpen={confirmingDelete}
        title="Delete this thing"
        message="This never enters the collection at all. Notion keeps it in its own trash for 30 days if you need it back. To let its season simply run out instead, use Release."
        confirmText="Delete"
        variant="danger"
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => {
          setConfirmingDelete(false)
          onDelete()
        }}
      />
    </li>
  )
}
