import { useEffect, useState } from 'react'
import { getPhoto } from './imageCache.ts'
import type { Garment } from './types.ts'

/**
 * The displayable URL for a garment's photo, or null while it loads (and
 * forever, if there isn't one).
 *
 * Null is not a failure state: the tile shows the garment's stored placeholder
 * underneath, so a slow, missing or offline photo degrades to a soft colour
 * rather than an empty box. That's why the placeholder lives on the row.
 */
export function useGarmentPhoto(garment: Garment | null): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setUrl(null)
    if (!garment) return
    getPhoto(garment.id, garment.photoUrl).then((next) => {
      if (!cancelled) setUrl(next)
    })
    return () => { cancelled = true }
    // photoUrl is a signed URL that changes on every page read; keying the
    // effect on it would refetch the whole grid on each refresh even though the
    // cache would answer instantly. The garment id is the stable identity.
    //
    // `thumb` is in here for one reason: it is regenerated from the new bytes
    // whenever a photo is REPLACED, and it's the only field on the row that
    // reliably changes when that happens. Without it the effect never re-runs
    // after a retake and the tile keeps its old picture. It's stable across
    // ordinary reads, so this costs nothing in the common case.
  }, [garment?.id, garment?.thumb]) // eslint-disable-line react-hooks/exhaustive-deps

  return url
}
