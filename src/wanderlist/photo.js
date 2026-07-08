// Client-side photo prep, browser-only (canvas). Used for the Photo field's picture —
// downscaled before it ever reaches Notion, since phone photos run several MB. The
// feeling is what matters, not resolution, so a bit of JPEG softness is fine. Ported
// from Journal of Delights' photo.js.
const MAX_EDGE = 1600
const JPEG_QUALITY = 0.82

export function isImageFile(file) {
  return Boolean(file && typeof file.type === 'string' && file.type.startsWith('image/'))
}

// Downscale to at most MAX_EDGE on the long side and re-encode as JPEG. Returns a Blob
// ready to upload. Browsers already read EXIF orientation when decoding into an
// <img>/ImageBitmap, so drawing to canvas bakes it in correctly.
export async function resizePhoto(file) {
  const source = await loadImageSource(file)
  const { width, height } = source
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height))
  const w = Math.max(1, Math.round(width * scale))
  const h = Math.max(1, Math.round(height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.drawImage(source, 0, 0, w, h)
  source.close?.() // ImageBitmap only

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not process that image.'))),
      'image/jpeg',
      JPEG_QUALITY
    )
  })
}

async function loadImageSource(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file) } catch { /* fall through to the <img> path */ }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    await new Promise((resolve, reject) => {
      img.onload = resolve
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
export function photoFilename(name) {
  const slug = String(name || 'photo').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'photo'
  return `${slug}.jpg`
}
