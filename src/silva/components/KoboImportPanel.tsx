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
  /** Only the highlights not already imported — nothing actionable exists
   *  for one that's already here, so it's not shown as a selectable row. */
  newHighlights: KoboHighlight[]
  alreadyImportedCount: number
  match: SourceMatch | null
  /** 'existing' when a match was proposed and not overridden; 'new' either
   *  when nothing matched or the user chose to create a Source anyway. */
  decision: 'existing' | 'new'
  newTitle: string
  /** Skip the whole book this round — nothing in it is imported, its
   *  Source decision is moot while this is set. */
  skipped: boolean
  /** Which of `newHighlights` (by bookmarkId) are checked for import.
   *  All new highlights start selected. */
  selectedIds: Set<string>
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
    const newHighlights = groupHighlights.filter((h) => !existingKoboBookmarkIds.has(h.bookmarkId))
    const match = matchSource(bookTitle, volumeId, existingSources)
    return {
      volumeId,
      bookTitle,
      author,
      newHighlights,
      alreadyImportedCount: groupHighlights.length - newHighlights.length,
      match,
      decision: match ? 'existing' : 'new',
      newTitle: bookTitle,
      skipped: false,
      selectedIds: new Set(newHighlights.map((h) => h.bookmarkId)),
    }
  })
}

function truncate(text: string, max = 90): string {
  return text.length > max ? `${text.slice(0, max)}…` : text
}

/** Drop `KoboReader.sqlite` onto the page — parses entirely in the browser,
 *  proposes a Source match per book (SILVA.md "Kobo import" and "Book
 *  matching is a step, not an inference"), and imports new highlights into
 *  the understory. Re-dropping the same file is a no-op (BookmarkID dedupe).
 *  Whole books and individual highlights can be left out of a given import
 *  round — nothing here is all-or-nothing. */
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

  function updateGroup(volumeId: string, patch: Partial<BookGroup>) {
    setGroups((prev) => prev.map((g) => (g.volumeId === volumeId ? { ...g, ...patch } : g)))
  }

  function toggleHighlight(volumeId: string, bookmarkId: string) {
    setGroups((prev) => prev.map((g) => {
      if (g.volumeId !== volumeId) return g
      const selectedIds = new Set(g.selectedIds)
      if (selectedIds.has(bookmarkId)) selectedIds.delete(bookmarkId)
      else selectedIds.add(bookmarkId)
      return { ...g, selectedIds }
    }))
  }

  function setAllSelected(volumeId: string, selected: boolean) {
    setGroups((prev) => prev.map((g) => (
      g.volumeId === volumeId
        ? { ...g, selectedIds: selected ? new Set(g.newHighlights.map((h) => h.bookmarkId)) : new Set() }
        : g
    )))
  }

  const importableGroups = groups.filter((g) => !g.skipped && g.selectedIds.size > 0)

  async function handleImport() {
    setPhase('importing')
    const created: Thing[] = []

    for (const group of importableGroups) {
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

      for (const highlight of group.newHighlights) {
        if (!group.selectedIds.has(highlight.bookmarkId)) continue
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
              <li key={group.volumeId} className={`${styles.group} ${group.skipped ? styles.groupSkipped : ''}`}>
                <div className={styles.groupHeader}>
                  <strong>{group.bookTitle}</strong>
                  <label className={styles.skipToggle}>
                    <input
                      type="checkbox"
                      checked={group.skipped}
                      onChange={(e) => updateGroup(group.volumeId, { skipped: e.target.checked })}
                    />
                    Skip this book
                  </label>
                </div>

                {group.alreadyImportedCount > 0 && (
                  <p className={styles.groupMeta}>
                    {group.alreadyImportedCount} highlight{group.alreadyImportedCount === 1 ? '' : 's'} already imported
                  </p>
                )}

                {!group.skipped && group.newHighlights.length > 0 && (
                  <>
                    {group.match ? (
                      <label className={styles.choice}>
                        <input
                          type="radio"
                          name={`decision-${group.volumeId}`}
                          checked={group.decision === 'existing'}
                          onChange={() => updateGroup(group.volumeId, { decision: 'existing' })}
                        />
                        Use existing source "{group.match.source.title}" ({group.match.confidence} match)
                      </label>
                    ) : null}

                    <label className={styles.choice}>
                      <input
                        type="radio"
                        name={`decision-${group.volumeId}`}
                        checked={group.decision === 'new'}
                        onChange={() => updateGroup(group.volumeId, { decision: 'new' })}
                      />
                      Create a new source
                      {group.decision === 'new' && (
                        <input
                          className={styles.titleInput}
                          value={group.newTitle}
                          onChange={(e) => updateGroup(group.volumeId, { newTitle: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                    </label>

                    <div className={styles.highlightsHeader}>
                      <span className={styles.groupMeta}>
                        {group.selectedIds.size} of {group.newHighlights.length} selected
                      </span>
                      <button type="button" className={styles.linkButton} onClick={() => setAllSelected(group.volumeId, true)}>All</button>
                      <button type="button" className={styles.linkButton} onClick={() => setAllSelected(group.volumeId, false)}>None</button>
                    </div>
                    <ul className={styles.highlightList}>
                      {group.newHighlights.map((highlight) => (
                        <li key={highlight.bookmarkId} className={styles.highlightRow}>
                          <label className={styles.choice}>
                            <input
                              type="checkbox"
                              checked={group.selectedIds.has(highlight.bookmarkId)}
                              onChange={() => toggleHighlight(group.volumeId, highlight.bookmarkId)}
                            />
                            {truncate(highlight.text)}
                          </label>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </li>
            ))}
          </ul>
          <Button onClick={handleImport} disabled={importableGroups.length === 0}>
            Import into the understory
          </Button>
        </>
      )}

      {phase === 'importing' && <p className={styles.status}>Importing…</p>}

      {phase === 'done' && (
        <p className={styles.status}>
          {importedCount > 0
            ? `Imported ${importedCount} thing${importedCount === 1 ? '' : 's'} into the understory.`
            : 'Nothing selected to import.'}
        </p>
      )}
    </div>
  )
}
