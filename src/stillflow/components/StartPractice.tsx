import { useMemo } from 'react'
import { Play, ExternalLink, Search } from 'lucide-react'
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

/** Practice link for any https YouTube URL (a video, or a search when nothing is linked). */
export function PracticeLink({
  url, label, compact = false, search = false, onLaunch, className,
}: { url: string; label: string; compact?: boolean; search?: boolean; onLaunch: () => void; className?: string }) {
  const { preferences } = useStillflow()
  const platform = usePlatform()
  const href = practiceHref(url, platform, preferences.openMethod)
  const Icon = search ? Search : Play
  return (
    // An intent:// link must navigate the current tab (Chrome hands it to the app
    // and the page stays put); a _blank target would first open an empty tab.
    <a className={cx(styles.start, compact && styles.compact, search && styles.search, className)} href={href}
      target={href.startsWith('intent:') ? undefined : '_blank'} rel="noopener noreferrer" onClick={onLaunch}>
      <Icon size={compact ? 16 : 18} strokeWidth={1.8} fill={search ? 'none' : 'currentColor'} />
      <span>{label}</span>
    </a>
  )
}

export function StartPractice({
  session, compact = false, label = 'Start practice', series,
}: { session: Session; compact?: boolean; label?: string; series?: { seriesId: string; day: number } }) {
  const { markLaunched } = useStillflow()
  return (
    <PracticeLink url={session.youtubeUrl} compact={compact} search={session.isDemo}
      label={session.isDemo && !compact ? 'Search on YouTube' : label}
      onLaunch={() => markLaunched({ sessionId: session.id, ...series })} />
  )
}

/** Plain https link in a browser tab: the always-available fallback. */
export function BrowserLink({ session }: { session: Session }) {
  const { markLaunched } = useStillflow()
  return (
    <a className={styles.browser} href={session.youtubeUrl} target="_blank" rel="noopener noreferrer"
      onClick={() => markLaunched({ sessionId: session.id })}>
      <ExternalLink size={14} strokeWidth={1.8} /> Open in browser instead
    </a>
  )
}
