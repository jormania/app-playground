// Client-side photo prep, browser-only (canvas). Phone photos run several MB, so
// everything is downscaled and re-encoded before it ever reaches Notion.
//
// Promoted to src/shared/ after being copied Journal → Wanderlist by hand; a third
// app (Fit Check) made the duplication untenable. Wanderlist now re-exports this;
// Journal keeps its own older copy, deliberately — it's design-locked legacy and
// there is nothing to gain from touching it.
const MAX_EDGE = 1600
const JPEG_QUALITY = 0.82

/** Anything the canvas path can decode: a File from a picker, or a Blob. */
type ImageInput = Blob & { type: string }

export function isImageFile(file: unknown): boolean {
  return Boolean(
    file &&
    typeof (file as ImageInput).type === 'string' &&
    (file as ImageInput).type.startsWith('image/')
  )
}

// Downscale to at most `maxEdge` on the long side and re-encode as JPEG. Returns a
// Blob ready to upload. Browsers already read EXIF orientation when decoding into an
// <img>/ImageBitmap, so drawing to canvas bakes it in correctly.
export async function resizePhoto(
  file: ImageInput,
  { maxEdge = MAX_EDGE, quality = JPEG_QUALITY }: { maxEdge?: number; quality?: number } = {}
): Promise<Blob> {
  const source = await loadImageSource(file)
  const { width, height } = source
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  const w = Math.max(1, Math.round(width * scale))
  const h = Math.max(1, Math.round(height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not process that image.')
  ctx.drawImage(source, 0, 0, w, h)
  if ('close' in source) source.close() // ImageBitmap only

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not process that image.'))),
      'image/jpeg',
      quality
    )
  })
}

async function loadImageSource(file: ImageInput): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file) } catch { /* fall through to the <img> path */ }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Could not read that image.'))
      img.src = url
    })
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

// A stable filename Notion can show in its own UI, independent of what the phone or
// computer originally called the file.
export function photoFilename(name: string | null | undefined): string {
  const slug = String(name || 'photo')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'photo'
  return `${slug}.jpg`
}
