/**
 * Field hints that explain what a field is for ("A 4-session package is 4.")
 * can be switched off in Settings once someone knows their way around, as Sol
 * Odyssey's guidance can. Hints that report something live (a rate being
 * fetched, a tax saving, a per-head figure) are not wrapped and always show.
 */
import { useInflow } from './state'

export function useHint(): <T>(text: T) => T | undefined {
  const { settings } = useInflow()
  return (text) => (settings.showHints ? text : undefined)
}
