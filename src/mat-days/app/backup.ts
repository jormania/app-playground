import { shareFile } from '../../shared/share'
import { downloadText, stamp } from '../lib/download'
import { useMatDays } from './state'

/**
 * Save a backup the way the phone does it best: the share sheet where files can be
 * shared (Drive is two taps away on Android), a download everywhere else. It only
 * counts as saved once it was shared or downloaded, so a dismissed sheet leaves the
 * reminder in place.
 */
export function useSaveBackup() {
  const { exportBackup, markBackedUp, toast } = useMatDays()
  return async () => {
    const b = await exportBackup()
    const name = `mat-days-backup-${stamp()}.json`
    const json = JSON.stringify(b, null, 2)
    const r = await shareFile(new File([json], name, { type: 'application/json' }), 'Mat Days backup')
    if (r.shared) { markBackedUp(b.exportedAt); toast('Backup shared', 'success'); return }
    if (r.cancelled) return
    downloadText(name, json, 'application/json')
    markBackedUp(b.exportedAt)
    toast('Backup saved to your downloads', 'success')
  }
}
