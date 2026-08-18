import { useRef, useState } from 'react'
import { Button } from '../../ds'
import { parseKoboDatabase, KoboParseError, type KoboHighlight } from '../lib/kobo'
import { matchSource, type SourceMatch } from '../lib/bookMatch'
import { SilvaStore } from '../lib/store'
import type { Source } from '../lib/sources'
import type { Thing } from '../lib/notion'
import styles from './KoboImportPanel.module.css'

export interface KoboImportPanelProps {
  store: SilvaStore
  /** For dedupe — re-importing the same file must be a no-op (SILVA.md). */
  existingKoboBookmarkIds: Set<string>
  onImported: (things: Thing[]) => void
  onClose: () => void
}

interface BookGroup {
  volumeId: string
  bookTitle: string
  author: string
  highlights: KoboHighlight[]
  newCount: number
  match: SourceMatch | null
  /** 'existing' when a match was proposed and not overridden; 'new' either
   *  when nothing matched or the user chose to create a Source anyway. */
  decision: 'existing' | 'new'
  newTitle: string
}

type Phase = 'idle' | 'parsing' | 'reviewing' | 'importing' | 'done' | 'error'

function groupByBook(
  highlights: KoboHighlight[],
  existingKoboBookmarkIds: Set<string>,
  existingSources: Source[],
): BookGroup[] {
  const byVolume = new Map<string, KoboHighlight[]>()
  for (const h of highlights) {
    const list = byVolume.get(h.volumeId) || []
    list.push(h)
    byVolume.set(h.volumeId, list)
  }

  return [...byVolume.entries()].map(([volumeId, groupHighlights]) => {
    const { bookTitle, author } = groupHighlights[0]
    const newCount = groupHighlights.filter((h) => !existingKoboBookmarkIds.has(h.bookmarkId)).length
    const match = matchSource(bookTitle, volumeId, existingSources)
    return {
      volumeId,
      bookTitle,
      author,
      highlights: groupHighlights,
      newCount,
      match,
      decision: match ? 'existing' : 'new',
      newTitle: bookTitle,
    }
  })
}

/** Drop `KoboReader.sqlite` onto the page — parses entirely in the browser,
 *  proposes a Source match per book (SILVA.md "Kobo import" and "Book
 *  matching is a step, not an inference"), and imports new highlights into
 *  the understory. Re-dropping the same file is a no-op (BookmarkID dedupe). */
export function KoboImportPanel({ store, existingKoboBookmarkIds, onImported, onClose }: KoboImportPanelProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState('')
  const [groups, setGroups] = useState<BookGroup[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setPhase('parsing')
    setError('')
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const highlights = await parseKoboDatabase(bytes)
      if (highlights.length === 0) {
        setError('No highlights found in this file.')
        setPhase('error')
        return
      }
      const existingSources = await store.listSources()
      setGroups(groupByBook(highlights, existingKoboBookmarkIds, existingSources))
      setPhase('reviewing')
    } catch (e) {
      setError(e instanceof KoboParseError ? e.message : 'Could not read this file.')
      setPhase('error')
    }
  }

  function setDecision(volumeId: string, decision: BookGroup['decision']) {
    setGroups((prev) => prev.map((g) => (g.volumeId === volumeId ? { ...g, decision } : g)))
  }

  function setNewTitle(volumeId: string, title: string) {
    setGroups((prev) => prev.map((g) => (g.volumeId === volumeId ? { ...g, newTitle: title } : g)))
  }

  async function handleImport() {
    setPhase('importing')
    const created: Thing[] = []

    for (const group of groups) {
      let sourceId: string
      if (group.decision === 'existing' && group.match) {
        sourceId = group.match.source.id
        // Confirming a fuzzy match backfills the Kobo id, so re-importing
        // this same book later hits the exact-match tier (lib/bookMatch.ts).
        if (group.match.confidence !== 'exact') {
          await store.updateSource(sourceId, { koboVolumeId: group.volumeId })
        }
      } else {
        const source = await store.createSource({
          title: group.newTitle,
          author: group.author,
          kind: 'Book',
          koboVolumeId: group.volumeId,
        })
        sourceId = source.id
      }

      for (const highlight of group.highlights) {
        if (existingKoboBookmarkIds.has(highlight.bookmarkId)) continue
        const thing = await store.createThing({
          body: highlight.text,
          note: highlight.annotation,
          kind: 'Passage',
          sourceId,
          encountered: highlight.dateCreated || new Date().toISOString().slice(0, 10),
          koboBookmarkId: highlight.bookmarkId,
        })
        created.push(thing)
      }
    }

    onImported(created)
    setImportedCount(created.length)
    setPhase('done')
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>Kobo import</h2>
        <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
      </div>

      {(phase === 'idle' || phase === 'error') && (
        <div
          className={`${styles.dropZone} ${dragActive ? styles.dropZoneActive : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragActive(false)
            const file = e.dataTransfer.files[0]
            if (file) handleFile(file)
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <p>Drop your <code>KoboReader.sqlite</code> here, or click to choose it.</p>
          <p className={styles.hint}>Nothing is uploaded — it's read entirely in this browser.</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".sqlite"
            className={styles.fileInput}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
          />
          {error && <p className={styles.error}>{error}</p>}
        </div>
      )}

      {phase === 'parsing' && <p className={styles.status}>Reading the file…</p>}

      {phase === 'reviewing' && (
        <>
          <ul className={styles.groups}>
            {groups.map((group) => (
              <li key={group.volumeId} className={styles.group}>
                <div className={styles.groupHeader}>
                  <strong>{group.bookTitle}</strong>
                  <span className={styles.groupMeta}>
                    {group.newCount} of {group.highlights.length} highlight{group.highlights.length === 1 ? '' : 's'} new
                  </span>
                </div>

                {group.match ? (
                  <label className={styles.choice}>
                    <input
                      type="radio"
                      name={`decision-${group.volumeId}`}
                      checked={group.decision === 'existing'}
                      onChange={() => setDecision(group.volumeId, 'existing')}
                    />
                    Use existing source "{group.match.source.title}" ({group.match.confidence} match)
                  </label>
                ) : null}

                <label className={styles.choice}>
                  <input
                    type="radio"
                    name={`decision-${group.volumeId}`}
                    checked={group.decision === 'new'}
                    onChange={() => setDecision(group.volumeId, 'new')}
                  />
                  Create a new source
                  {group.decision === 'new' && (
                    <input
                      className={styles.titleInput}
                      value={group.newTitle}
                      onChange={(e) => setNewTitle(group.volumeId, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                </label>
              </li>
            ))}
          </ul>
          <Button onClick={handleImport} disabled={groups.every((g) => g.newCount === 0)}>
            Import into the understory
          </Button>
        </>
      )}

      {phase === 'importing' && <p className={styles.status}>Importing…</p>}

      {phase === 'done' && (
        <p className={styles.status}>
          {importedCount > 0
            ? `Imported ${importedCount} thing${importedCount === 1 ? '' : 's'} into the understory.`
            : 'Nothing new to import — every highlight in this file is already here.'}
        </p>
      )}
    </div>
  )
}
