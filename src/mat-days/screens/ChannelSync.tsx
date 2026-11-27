import { useEffect, useState } from 'react'
import { RefreshCw, MonitorPlay, CloudDownload } from 'lucide-react'
import { Button } from '../../ds'
import { useMatDays } from '../app/state'
import { apiCheckIds, apiFetchPage, checkLibrary, isPractice, scanChannel, videoToRecord, YWA_CHANNEL, type CheckIds, type FetchPage } from '../lib/channel'
import { applyAvailability, isUnavailable } from '../lib/today'
import { previewImport, type ImportPreview } from '../lib/importExport'
import { daysBetween } from '../lib/recommend'
import { localDate } from '../lib/practice'
import { ImportReview } from './ImportPanel'
import s from './screens.module.css'

/**
 * Settings → Yoga With Adriene on YouTube. Only ever on request: nothing here
 * runs on its own. "Check for updates" reads the newest uploads until it meets
 * videos you already have; "Import the whole channel" reads everything. Both
 * end in the ordinary import review.
 */
export function ChannelSync({ fetchPage = apiFetchPage(), checkIds = apiCheckIds() }: { fetchPage?: FetchPage; checkIds?: CheckIds }) {
  const { sessions, preferences, savePreferences, upsertSessions } = useMatDays()
  const [goneNote, setGoneNote] = useState('')
  const [busy, setBusy] = useState<null | 'updates' | 'all'>(null)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [review, setReview] = useState<{ preview: ImportPreview; title: string; note: string } | null>(null)
  const [online, setOnline] = useState(() => navigator.onLine)
  const last = preferences.channelCheck

  useEffect(() => {
    const on = () => setOnline(navigator.onLine)
    window.addEventListener('online', on)
    window.addEventListener('offline', on)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', on) }
  }, [])

  const run = async (mode: 'updates' | 'all') => {
    setBusy(mode)
    setError('')
    setProgress('Asking YouTube…')
    try {
      const known = new Set(sessions.map((x) => x.youtubeVideoId).filter(Boolean))
      const scan = await scanChannel({
        mode, knownIds: known, fetchPage,
        onProgress: (read, total) => setProgress(`Read ${read}${total ? ` of about ${total}` : ''} videos…`),
      })
      const practices = scan.videos.filter(isPractice)
      const shorts = scan.videos.length - practices.length
      // An update check shows only what's new; a full import also offers to fill in videos you have.
      const chosen = mode === 'updates' ? practices.filter((v) => !known.has(v.videoId)) : practices
      const now = new Date().toISOString()
      let availabilityCheck = preferences.availabilityCheck
      setGoneNote('')
      // With the API key, the same check also asks which of your videos still play,
      // so a video Adriene made private stops being suggested. Its history stays.
      if (scan.source === 'api' && known.size) {
        try {
          setProgress('Checking your videos still play…')
          const r = await checkLibrary([...known] as string[], checkIds, (d, t) => setProgress(`Checking your videos still play: ${d} of ${t}…`))
          const changed = applyAvailability(sessions, r.checked, r.available)
          if (changed.length) await upsertSessions(changed)
          const gone = sessions.filter((x) => x.youtubeVideoId && r.checked.includes(x.youtubeVideoId) && !r.available.includes(x.youtubeVideoId)).length
          availabilityCheck = { at: now, checked: r.checked.length, gone }
          const back = changed.filter((x) => !isUnavailable(x)).length
          setGoneNote([
            gone ? `${gone} of your videos no longer play on YouTube. They’re marked and left out of suggestions; your history keeps them.` : 'Every video in your library still plays.',
            back ? `${back} came back and are suggested again.` : '',
          ].filter(Boolean).join(' '))
        } catch {
          setGoneNote('Couldn’t check whether your videos still play this time.')
        }
      }
      savePreferences({ ...preferences, availabilityCheck, channelCheck: { at: now, source: scan.source, found: practices.filter((v) => !known.has(v.videoId)).length } })
      const notes = [
        shorts ? `${shorts} short${shorts === 1 ? '' : 's'} under four minutes left out.` : '',
        'Style, body area, intensity and series are read from each title and description, and marked as a guess until you check them.',
        scan.source === 'rss' ? 'Without a YouTube API key only the 15 newest uploads are visible, without durations.' : '',
      ].filter(Boolean).join(' ')
      if (chosen.length === 0) {
        setProgress(mode === 'updates' ? 'You’re up to date: nothing new on the channel.' : 'Nothing to import.')
        return
      }
      setProgress('')
      setReview({
        preview: previewImport(JSON.stringify(chosen.map((v) => videoToRecord(v))), 'json', sessions, now, preferences.defaultInstructor),
        title: mode === 'updates' ? `${chosen.length} new on ${YWA_CHANNEL.name}` : `${YWA_CHANNEL.name}: whole channel`,
        note: notes,
      })
    } catch (e) {
      setProgress('')
      setError(e instanceof Error ? e.message : 'The channel could not be read.')
    } finally {
      setBusy(null)
    }
  }

  const age = last ? daysBetween(localDate(new Date(last.at)), localDate()) : null

  return (
    <section className={s.panel}>
      <h2><MonitorPlay size={20} style={{ verticalAlign: '-3px' }} /> {YWA_CHANNEL.name} on YouTube</h2>
      <p className={s.muted} style={{ marginBottom: 'var(--space-md)' }}>
        Bring Adriene’s videos into your library whenever you ask. Titles, lengths and dates come straight from YouTube;
        style, body area and series are read from each title and description for you to check.
        {last ? ` Last checked ${age === 0 ? 'today' : age === 1 ? 'yesterday' : `${age} days ago`}: ${last.found} new.` : ' Not checked yet.'}
      </p>
      <div className={s.row}>
        <Button onClick={() => void run('updates')} disabled={!!busy || !online}>
          <RefreshCw size={16} className={busy === 'updates' ? s.spin : undefined} /> Check for updates
        </Button>
        <Button variant="outline" onClick={() => void run('all')} disabled={!!busy || !online}>
          <CloudDownload size={16} /> Import the whole channel
        </Button>
      </div>
      {!online && <p className={s.muted} style={{ marginTop: 'var(--space-sm)' }}>You’re offline. Connect to the internet to check YouTube.</p>}
      {progress && <p className={s.muted} role="status" style={{ marginTop: 'var(--space-sm)' }}>{progress}</p>}
      {goneNote && <p className={s.muted} role="status" style={{ marginTop: 'var(--space-sm)' }}>{goneNote}</p>}
      {error && <p role="alert" style={{ marginTop: 'var(--space-sm)', color: 'var(--color-danger)' }}>{error}</p>}
      {last?.source === 'rss' && (
        <p className={s.entryMeta} style={{ marginTop: 'var(--space-sm)' }}>
          Reading the whole channel needs a free YouTube Data API key set as YOUTUBE_API_KEY on the Vercel project. Without it, only the 15 newest videos are visible.
        </p>
      )}
      {review && <ImportReview preview={review.preview} title={review.title} note={review.note} onClose={() => setReview(null)} />}
    </section>
  )
}
