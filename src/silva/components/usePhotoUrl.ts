import { useEffect, useState } from 'react'
import { isLocalImage, localPhotoUrl } from '../lib/photoStore'

/**
 * Resolves a `Thing.image` — a real Notion URL, or a local IndexedDB
 * reference — to a usable `<img src>`, revoking the created object URL when
 * the image changes or the component unmounts.
 *
 * Shared by SpecimenPlate's full-size photo and NurseryView's small
 * thumbnail, so a photographed page looks like the same object at both
 * sizes rather than two components each guessing at the lifecycle.
 */
export function usePhotoUrl(image: string | null | undefined): string | null {
  const [src, setSrc] = useState<string | null>(image && !isLocalImage(image) ? image : null)

  useEffect(() => {
    if (!image) {
      setSrc(null)
      return
    }
    if (!isLocalImage(image)) {
      setSrc(image)
      return
    }
    let objectUrl: string | null = null
    let cancelled = false
    localPhotoUrl(image).then((url) => {
      if (cancelled) {
        if (url) URL.revokeObjectURL(url)
        return
      }
      objectUrl = url
      setSrc(url)
    })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [image])

  return src
}
