/**
 * The Review's list of pain points and wins.
 */
import { AlertTriangle, Lightbulb, TrendingUp } from 'lucide-react'
import type { Insight } from '../lib/insights'
import styles from '../styles/ui.module.css'

export function InsightList({ items, limit }: { items: Insight[]; limit?: number }) {
  const shown = limit ? items.slice(0, limit) : items
  if (!shown.length) return <p className={styles.hint}>Nothing stands out in this period. Try a longer one, like Year.</p>
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
            {i.link && <a className={styles.linkButton} href={i.link.hash}>{i.link.label} →</a>}
          </span>
        </li>
      ))}
    </ul>
  )
}
