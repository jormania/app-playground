/**
 * The Review's list of pain points and wins.
 */
import { useState } from 'react'
import { AlertTriangle, Lightbulb, ThumbsDown, ThumbsUp, TrendingUp } from 'lucide-react'
import type { InsightFeedback } from '../app/insightFeedback'
import { RULE_LABEL, type Insight } from '../lib/insights'
import styles from '../styles/ui.module.css'

export function InsightList({ items, limit, feedback, onHidden }: {
  items: Insight[]
  limit?: number
  /** With feedback, each insight gets 👍 / 👎; 👎 offers to hide it, or all like it. */
  feedback?: InsightFeedback
  onHidden?: (undo: () => void, what: string) => void
}) {
  const [asking, setAsking] = useState<string | null>(null)
  const list = feedback ? feedback.apply(items) : items
  const shown = limit ? list.slice(0, limit) : list
  if (!shown.length) return <p className={styles.hint}>Nothing stands out in this period.</p>
  const hide = (i: Insight, all: boolean) => {
    if (!feedback) return
    const before = feedback.feedback
    if (all) feedback.mute(i.rule)
    else feedback.hide(i)
    setAsking(null)
    onHidden?.(() => feedback.restore(before), all ? `Hidden: ${RULE_LABEL[i.rule].toLowerCase()}` : 'Insight hidden')
  }
  return (
    <ul className={styles.insights}>
      {shown.map((i) => (
        <li key={i.id} className={`${styles.insight} ${styles[`insight_${i.kind}`]}`}>
          <span className={styles.insightIcon} aria-hidden>
            {i.kind === 'pain' ? <AlertTriangle size={16} /> : i.kind === 'win' ? <TrendingUp size={16} /> : <Lightbulb size={16} />}
          </span>
          <span>
            <span className={styles.insightKind}>{i.kind === 'pain' ? 'Pain point' : i.kind === 'win' ? 'Working well' : 'Worth knowing'}</span>
            <b className={styles.insightTitle}>{i.title}</b>
            <span className={styles.insightDetail}>{i.detail}</span>
            <span className={styles.insightFoot}>
              {i.link ? <a className={styles.linkButton} href={i.link.hash}>{i.link.label} →</a> : <span />}
              {feedback && (
                <span className={styles.insightVotes}>
                  <button type="button" className={`${styles.vote} ${feedback.isLiked(i.id) ? styles.voteOn : ''}`} aria-pressed={feedback.isLiked(i.id)}
                    aria-label="Useful" title="Useful: keep it near the top" onClick={() => feedback.toggleLike(i)}><ThumbsUp size={15} aria-hidden /></button>
                  <button type="button" className={styles.vote} aria-expanded={asking === i.id}
                    aria-label="Not useful" title="Not useful" onClick={() => setAsking((a) => (a === i.id ? null : i.id))}><ThumbsDown size={15} aria-hidden /></button>
                </span>
              )}
            </span>
            {asking === i.id && (
              <span className={styles.hideChoice}>
                <button type="button" onClick={() => hide(i, false)}>Hide this one</button>
                <button type="button" onClick={() => hide(i, true)}>Hide all about {RULE_LABEL[i.rule].toLowerCase()}</button>
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}
