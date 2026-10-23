import { useEffect, useState } from 'react'
import { useServices } from '../app/services'
import { backupDue, downloadBackup, lastBackup, snoozeBackupNudge } from '../app/backup'
import { dateWords, messageOf } from './common'
import s from '../styles/editorial.module.css'

/**
 * Once in a while, on This week: the journey lives only on this device, and
 * no backup has been saved for four weeks (or ever). One line, saved from
 * here in one tap, or put off for a fortnight — never a badge or a count.
 */
export function BackupNudge() {
  const { repo, settings, say } = useServices()
  const [due, setDue] = useState(false)
  const [last, setLast] = useState(lastBackup)
  useEffect(() => {
    let live = true
    void repo.weeks.all().then((weeks) => { if (live) setDue(backupDue(weeks.length, lastBackup())) }, () => {})
    return () => { live = false }
  }, [repo])
  if (!due) return null

  async function save() {
    try {
      await downloadBackup(repo, 'the-long-listen', settings.timeZone)
      setLast(lastBackup())
      setDue(false)
      say('A backup is in your downloads.', 'success')
    } catch (e) {
      say(messageOf(e), 'danger')
    }
  }

  return (
    <p className={s.backupNudge} role="note">
      Your journey is kept only on this device{last ? ` — the last backup was saved on ${dateWords(last, settings.timeZone)}` : ', and no backup has been saved yet'}.{' '}
      <button className={s.textButton} onClick={() => void save()}>Save a backup</button>
      {' · '}
      <button className={`${s.textButton} ${s.quietButton}`} onClick={() => { snoozeBackupNudge(); setDue(false) }}>Not now</button>
    </p>
  )
}
