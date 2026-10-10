import { useEffect, useState } from 'react'
import { useLoad, useServices } from '../app/services'
import { askedMark, nextToAsk } from '../domain/landed'
import { href } from '../app/router'
import { FeedbackPanel } from './FeedbackPanel'
import s from '../styles/editorial.module.css'

/**
 * Once, quietly, at the top of the screen: a work Spotify noticed you hear,
 * and that you haven't said anything about. Answering or "Not now" both
 * close it for good; leaving it there does too, since it's marked asked as
 * soon as it's shown — it won't come back on the next open.
 */
export function LandedPrompt() {
  const { repo } = useServices()
  const [closed, setClosed] = useState(false)
  // Read once per mount: the prompt shouldn't swap to another work mid-sitting.
  const { data } = useLoad(async () => {
    const [events, feedback, programmes, marks] = await Promise.all([repo.events.all(), repo.feedback.all(), repo.programmes.all(), repo.marks.all()])
    const asked = new Set(marks.filter((m) => m.id.startsWith('asked:')).map((m) => m.id.slice('asked:'.length)))
    return { ask: nextToAsk(events, feedback, asked, programmes), feedback }
  }, [])
  const [ask, setAsk] = useState<ReturnType<typeof nextToAsk>>(null)
  useEffect(() => { if (data?.ask && !ask) setAsk(data.ask) }, [data, ask])
  useEffect(() => {
    // Under the recording that played — a stand-in's own, where one stood in.
    if (ask) void repo.marks.put({ id: askedMark(ask.recordingId), at: new Date().toISOString() })
  }, [ask, repo])

  if (!ask || closed || !data) return null
  // A reaction belongs to the recording heard, as on the programme page: the
  // stand-in's, where Spotify lacked the curator's and it played instead.
  const { item, programme, recordingId } = ask
  return (
    <aside className={s.landed} aria-label="How did it land?">
      <p className={s.landedLead}>
        Spotify says you heard <a href={href({ name: 'programme', id: programme.id })} className={s.quietLink}>{item.proposed.composer}’s {item.proposed.work}</a>.
      </p>
      <FeedbackPanel
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
