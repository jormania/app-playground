import { useState } from 'react'
import { Upload } from 'lucide-react'
import { Button, Modal, SegmentedControl } from '../../ds'
import { useStillflow } from '../app/state'
import { detectFormat, planImport, previewImport, type DuplicateMode, type ImportPlan, type ImportPreview } from '../lib/importExport'
import s from './screens.module.css'

/**
 * Catalogue import: choose a file, see every row's fate before anything is
 * written, decide how duplicates are handled, then commit.
 */
export function ImportPanel() {
  const { sessions, upsertSessions, preferences, toast } = useStillflow()
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [fileName, setFileName] = useState('')
  const [mode, setMode] = useState<DuplicateMode>('skip')
  const [result, setResult] = useState<ImportPlan | null>(null)
  const [busy, setBusy] = useState(false)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    const text = await file.text()
    setFileName(file.name)
    setResult(null)
    setPreview(previewImport(text, detectFormat(file.name, text), sessions, new Date().toISOString(), preferences.defaultInstructor))
  }

  const plan = preview && !preview.fatal ? planImport(preview, sessions, mode) : null
  const dupes = preview?.rows.filter((r) => r.status === 'duplicate').length ?? 0

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

  const close = () => { setPreview(null); setResult(null) }

  return (
    <>
      <label className={`${s.fileButton}`}>
        <Button variant="outline" tabIndex={-1}><Upload size={16} /> Import JSON or CSV</Button>
        <input type="file" accept=".json,.csv,application/json,text/csv" aria-label="Import a JSON or CSV catalogue file"
          onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
      </label>

      <Modal open={!!preview} onClose={close} title={result ? 'Import complete' : `Import ${fileName}`}>
        {preview?.fatal && <p>{preview.fatal}</p>}
        {result && (
          <div className={s.stack}>
            <p>{result.added} added · {result.updated} updated · {result.replaced} replaced · {result.skipped} skipped · {result.invalid} not imported</p>
            {result.invalid > 0 && <p className={s.muted}>Rows that weren’t imported are listed with their reasons below. Fix them in the file and import again.</p>}
          </div>
        )}
        {preview && !preview.fatal && (
          <>
            {!result && (
              <p className={s.muted}>
                {preview.rows.length} rows: {preview.rows.filter((r) => r.status === 'new').length} new, {dupes} already in your library,{' '}
                {preview.rows.filter((r) => r.status === 'invalid').length} with problems. Nothing is saved until you confirm.
              </p>
            )}
            <div className={s.previewScroll}>
              <table className={s.previewTable}>
                <thead><tr><th>#</th><th>Session</th><th>Status</th></tr></thead>
                <tbody>
                  {preview.rows.map((r) => (
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
                      <td><span className={`${s.status} ${s[`status_${r.status}`]}`}>{r.status === 'duplicate' ? 'Already in library' : r.status === 'new' ? 'New' : 'Not importable'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!result && (
              <div className={s.stack}>
                {dupes > 0 && (
                  <SegmentedControl label="When a video is already in your library" value={mode} onChange={(v) => setMode(v as DuplicateMode)} wrap
                    options={[{ value: 'skip', label: 'Skip it' }, { value: 'update', label: 'Fill in new details' }, { value: 'replace', label: 'Replace it' }]} />
                )}
                <div className={s.row} style={{ justifyContent: 'flex-end' }}>
                  <Button variant="secondary" onClick={close}>Cancel</Button>
                  <Button onClick={() => void commit()} disabled={busy || !plan || plan.write.length === 0}>
                    Import {plan?.write.length ?? 0} {plan?.write.length === 1 ? 'session' : 'sessions'}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
        {(result || preview?.fatal) && <div className={s.row} style={{ justifyContent: 'flex-end', marginTop: 'var(--space-md)' }}><Button onClick={close}>Done</Button></div>}
      </Modal>
    </>
  )
}
