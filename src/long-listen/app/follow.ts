import { useState } from 'react'
import { useServices } from './services'
import { go } from './router'
import { messageOf } from '../components/common'

/**
 * A seed — a question the curator heard, where a thread could go next, a thread
 * to come back to — turned into three directions in one tap. Before a choice
 * this week they replace the three on offer (which stay open); after one they
 * wait under "Where next"; with no week yet, its first three start from it.
 * One way for the Notebook and Threads alike.
 */
export function useFollow(): { following: string | null; follow: (seed: string, after?: () => Promise<void>) => Promise<void> } {
  const { repo, journey, bump, say, week } = useServices()
  const [following, setFollowing] = useState<string | null>(null)
  async function follow(seed: string, after?: () => Promise<void>) {
    setFollowing(seed)
    try {
      const thisWeek = await repo.weeks.get(week.key)
      let said: string | undefined
      if (thisWeek?.programmeId) {
        await journey.moreDirections(seed)
        said = 'Three directions from it are waiting under “Where next”, at the end of this week’s programme.'
      } else if (thisWeek) {
        await journey.offerOtherDirections(seed)
        said = 'Three directions from it are on This week. The three before stay open.'
      } else {
        // No week yet: its first three directions start from the seed — one call, and next week's wish is left alone.
        await journey.ensureWeek(seed)
      }
      await after?.()
      bump()
      if (said) say(said, 'success')
      go({ name: 'week' })
    } catch (e) {
      say(messageOf(e), 'danger')
    } finally {
      setFollowing(null)
    }
  }
  return { following, follow }
}
