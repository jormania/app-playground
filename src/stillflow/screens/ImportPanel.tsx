import { useState } from 'react'
import { Upload } from 'lucide-react'
import { Button, Modal, SegmentedControl } from '../../ds'
import { useStillflow } from '../app/state'
import { detectFormat, planImport, previewImport, type DuplicateMode, type ImportPlan, type ImportPreview } from '../lib/importExport'
import s from './screens.module.css'

/** Rows drawn in the preview table; a whole-channel import can hold 750. */
const SHOWN_ROWS = 300

/**
 * The import review: every row's fate before anything is written, how
 * duplicates are handled, then commit. Shared by file import and the channel.
 */
export function ImportReview({ preview, title, note, onClose }: {
  preview: ImportPreview
  title: string
  note?: string
  onClose: () => void
}) {
  const { sessions, upsertSessions, toast } = useStillflow()
  const [mode, setMode] = useState<DuplicateMode>('skip')
  const [result, setResult] = useState<ImportPlan | null>(null)
  const [busy, setBusy] = useState(false)

  const plan = !preview.fatal ? planImport(preview, sessions, mode) : null
  const count = (st: string) => preview.rows.filter((r) => r.status === st).length
  const dupes = count('duplicate')

  const commit = async () => {
    if (!plan) return
    setBusy(true)
    try {
      await upsertSessions(plan.write)
      setResult(plan)
      toast(`Imported: ${plan.added} added, ${plan.updated + plan.replaced} changed`, 'success')
    } catch (e) {
      console.error(e)
      toast('The import could not be saved. Nothing was changed.', 'danger')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={result ? 'Import complete' : title}>
      {preview.fatal && <p>{preview.fatal}</p>}
      {result && (
        <div className={s.stack}>
          <p>{result.added} added · {result.updated} updated · {result.replaced} replaced · {result.skipped} skipped · {result.invalid} not imported</p>
          {result.invalid > 0 && <p className={s.muted}>The rows that couldn’t be imported are listed below, each with what to fix.</p>}
        </div>
      )}
      {!preview.fatal && (
        <>
          {!result && (
            <p className={s.muted}>
              {preview.rows.length} rows: {count('new')} new, {dupes} already in your library, {count('invalid')} with problems. Nothing is saved until you confirm.
              {note ? ` ${note}` : ''}
            </p>
          )}
          <div className={s.previewScroll}>
            <table className={s.previewTable}>
              <thead><tr><th>#</th><th>Session</th><th>Status</th></tr></thead>
              <tbody>
                {preview.rows.slice(0, SHOWN_ROWS).map((r) => (
                  <tr key={r.index}>
                    <td>{r.index + 1}</td>
                    <td>
                      {r.title || <em>Untitled</em>}
                      {r.session && <span className={s.muted}> · {r.session.durationMinutes} min</span>}
                      {(r.errors.length > 0 || r.warnings.length > 0) && (
                        <ul className={s.issues}>
                          {r.errors.map((e) => <li key={e}><strong>{e}</strong></li>)}
                          {r.warnings.map((w) => <li key={w}>{w}</li>)}
                        </ul>
                      )}
                    </td>
                    <td><span className={`${s.status} ${s[`status_${r.status}`]}`}>{r.status === 'duplicate' ? 'Already in library' : r.status === 'new' ? 'New' : 'Can’t import'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.rows.length > SHOWN_ROWS && <p className={s.muted}>…and {preview.rows.length - SHOWN_ROWS} more rows, imported the same way.</p>}
          </div>
          {!result && (
            <div className={s.stack}>
              {dupes > 0 && (
                <SegmentedControl label="When a video is already in your library" value={mode} onChange={(v) => setMode(v as DuplicateMode)} wrap
                  options={[{ value: 'skip', label: 'Skip it' }, { value: 'update', label: 'Fill in new details' }, { value: 'replace', label: 'Replace it' }]} />
              )}
              <div className={s.row} style={{ justifyContent: 'flex-end' }}>
                <Button variant="secondary" onClick={onClose}>Cancel</Button>
                <Button onClick={() => void commit()} disabled={busy || !plan || plan.write.length === 0}>
                  {busy ? 'Importing…' : `Import ${plan?.write.length ?? 0} ${plan?.write.length === 1 ? 'session' : 'sessions'}`}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
      {(result || preview.fatal) && <div className={s.row} style={{ justifyContent: 'flex-end', marginTop: 'var(--space-md)' }}><Button onClick={onClose}>Done</Button></div>}
    </Modal>
  )
}

/** Catalogue import from a JSON or CSV file. */
export function ImportPanel() {
  const { sessions, preferences } = useStillflow()
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [fileName, setFileName] = useState('')

  const onFile = async (file: File | undefined) => {
    if (!file) return
    const text = await file.text()
    setFileName(file.name)
    setPreview(previewImport(text, detectFormat(file.name, text), sessions, new Date().toISOString(), preferences.defaultInstructor))
  }

  return (
    <>
      <label className={s.fileButton}>
        <Button variant="outline" tabIndex={-1}><Upload size={16} /> Import JSON or CSV</Button>
        <input type="file" accept=".json,.csv,application/json,text/csv" aria-label="Import a JSON or CSV catalogue file"
          onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
      </label>
      {preview && <ImportReview preview={preview} title={`Import ${fileName}`} onClose={() => setPreview(null)} />}
    </>
  )
}
