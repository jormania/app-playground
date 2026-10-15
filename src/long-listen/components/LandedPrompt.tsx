import { useEffect, useState } from 'react'
import { curly } from '../domain/programmeStyle'
import { useLoad, useServices } from '../app/services'
import { askedMark, nextToAsk } from '../domain/landed'
import { standInsOf } from '../domain/standIns'
import { href } from '../app/router'
import { FeedbackPanel } from './FeedbackPanel'
import { usePlayerState } from '../app/playback'
import { playbackOf } from '../spotify/client'
import s from '../styles/editorial.module.css'

/**
 * Once, quietly, at the top of the screen: a work Spotify noticed you hear,
 * and that you haven't said anything about. Answering or "Not now" both
 * close it for good; leaving it there does too, since it's marked asked as
 * soon as it's shown — it won't come back on the next open.
 */
export function LandedPrompt() {
  const { repo } = useServices()
  const player = usePlayerState()
  const [closed, setClosed] = useState(false)
  // Read once per mount: the prompt shouldn't swap to another work mid-sitting.
  const { data } = useLoad(async () => {
    const [events, feedback, programmes, marks, comparisons] = await Promise.all([repo.events.all(), repo.feedback.all(), repo.programmes.all(), repo.marks.all(), repo.comparisons.all()])
    const asked = new Set(marks.filter((m) => m.id.startsWith('asked:')).map((m) => m.id.slice('asked:'.length)))
    // A stand-in is read as the item it stood in for (domain/standIns.ts).
    const ask = nextToAsk(events, feedback, asked, programmes, standInsOf(comparisons))
    // Its tracks, to tell whether it is still playing (below).
    const tracks = ask ? (await repo.recordings.get(ask.recordingId))?.spotify?.trackIds ?? [] : []
    return { ask, feedback, tracks }
  }, [])
  const [ask, setAsk] = useState<ReturnType<typeof nextToAsk>>(null)
  useEffect(() => { if (data?.ask && !ask) setAsk(data.ask) }, [data, ask])
  // Still inside the work, before its last movement (a pause in movement II already reads as heard
  // in Spotify's history, two of three): not yet — asked once it's over, and only then marked asked.
  const at = data?.tracks.length ? playbackOf(player.np, data.tracks) : null
  const midWork = Boolean(at && data && at.index < data.tracks.length - 1)
  useEffect(() => {
    if (midWork) return
    // Under the recording that played — a stand-in's own, where one stood in.
    // Quietly: a mark that didn't keep only means the question may come once more.
    if (ask) void repo.marks.put({ id: askedMark(ask.recordingId), at: new Date().toISOString() }).catch(() => {})
  }, [ask, repo, midWork])

  if (!ask || closed || !data || midWork) return null
  // A reaction belongs to the recording heard, as on the programme page: the
  // stand-in's, where Spotify lacked the curator's and it played instead.
  const { item, programme, recordingId } = ask
  return (
    <aside className={s.landed} aria-label="How did it land?">
      <p className={s.landedLead}>
        Spotify says you heard <a href={href({ name: 'programme', id: programme.id })} className={s.quietLink}>{item.proposed.composer}’s {curly(item.proposed.work)}</a>.
      </p>
      <FeedbackPanel
        place="landed"
        targets={[{ type: 'recording', id: recordingId, label: 'This recording' }, { type: 'work', id: item.workId, label: 'The work itself' }]}
        programmeId={programme.id}
        feedback={data.feedback}
        prompt="How did it land?"
        startOpen
        onClose={() => setClosed(true)}
      />
    </aside>
  )
}
