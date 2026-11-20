import { useMemo } from 'react'
import { Play, ExternalLink } from 'lucide-react'
import type { Session } from '../domain/types'
import { useStillflow } from '../app/state'
import { detectPlatform, practiceHref } from '../lib/youtube'
import { cx } from '../../ds/lib/cx'
import styles from './StartPractice.module.css'

/**
 * Start Practice is a real link, not a script-driven redirect: Android and iOS
 * only hand a URL to the YouTube app when it comes from a genuine user tap on
 * an anchor. Tapping also records a pending launch, so returning to Stillflow
 * offers Mark as Completed. Nothing is marked complete on launch.
 */
export function usePlatform() {
  return useMemo(() => detectPlatform(navigator.userAgent, navigator.maxTouchPoints ?? 0), [])
}

export function StartPractice({ session, compact = false, label = 'Start practice' }: { session: Session; compact?: boolean; label?: string }) {
  const { preferences, markLaunched } = useStillflow()
  const platform = usePlatform()
  const href = practiceHref(session.youtubeUrl, platform, preferences.openMethod)
  return (
    // An intent:// link must navigate the current tab (Chrome hands it to the app
    // and the page stays put); a _blank target would first open an empty tab.
    <a className={cx(styles.start, compact && styles.compact)} href={href}
      target={href.startsWith('intent:') ? undefined : '_blank'} rel="noopener noreferrer"
      onClick={() => markLaunched(session.id)}>
      <Play size={compact ? 16 : 18} strokeWidth={1.8} fill="currentColor" />
      <span>{session.isDemo && !compact ? 'Search on YouTube' : label}</span>
    </a>
  )
}

/** Plain https link in a browser tab: the always-available fallback. */
export function BrowserLink({ session }: { session: Session }) {
  const { markLaunched } = useStillflow()
  return (
    <a className={styles.browser} href={session.youtubeUrl} target="_blank" rel="noopener noreferrer"
      onClick={() => markLaunched(session.id)}>
      <ExternalLink size={14} strokeWidth={1.8} /> Open in browser instead
    </a>
  )
}
