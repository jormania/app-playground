import { useEffect, useState } from 'react'
import { getLinkPreview, type LinkPreview } from '../lib/linkPreviewCache'

/** The Open Graph preview for a Link thing's `link`, or null while it's
 *  loading (or if there's simply nothing to show) — a link never blocks on
 *  this, it just renders plain until the preview resolves. */
export function useLinkPreview(url: string | null | undefined): LinkPreview | null {
  const [preview, setPreview] = useState<LinkPreview | null>(null)

  useEffect(() => {
    setPreview(null)
    if (!url) return
    let cancelled = false
    getLinkPreview(url).then((p) => {
      if (!cancelled) setPreview(p)
    })
    return () => {
      cancelled = true
    }
  }, [url])

  return preview
}
