/**
 * The one lookup for a word's dictionary definition — used by the mid-game hint and the
 * post-game reveal alike.
 *
 * Distinguishes "the API doesn't carry this word" (its own 404, or a 200 with nothing
 * usable in it) from a genuine network/server failure. Both used to land in the same
 * catch block in each caller and get reported to the player as "check your connection",
 * which was simply wrong for a word the API just doesn't have an entry for.
 */

export type DefinitionStatus = 'found' | 'not-found' | 'error'

export interface DefinitionResult {
  status: DefinitionStatus
  text?: string
}

interface DictionaryApiEntry {
  meanings?: { definitions?: { definition?: string }[] }[]
}

export async function fetchDefinition(word: string): Promise<DefinitionResult> {
  let res: Response
  try {
    res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`)
  } catch {
    return { status: 'error' }
  }

  if (res.status === 404) return { status: 'not-found' }
  if (!res.ok) return { status: 'error' }

  let data: DictionaryApiEntry[]
  try {
    data = await res.json()
  } catch {
    return { status: 'error' }
  }

  const found = data?.[0]?.meanings?.[0]?.definitions?.[0]?.definition
  return found ? { status: 'found', text: found } : { status: 'not-found' }
}
