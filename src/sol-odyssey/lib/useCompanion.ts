import { useMutation } from '@tanstack/react-query'
import { useSettings } from './settingsContext'
import { requestCompanionReflection, type CompanionPrompt } from './companion'

/** Ask the optional AI companion for a reflection. Ephemeral by design — the result is held in
 *  the mutation only, never cached to Notion; re-running replaces it. */
export function useCompanion() {
  const { settings } = useSettings()
  return useMutation<string, Error, CompanionPrompt>({
    mutationFn: (prompt) => requestCompanionReflection(settings.anthropicKey, prompt),
  })
}
