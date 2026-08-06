/**
 * The tiny placeholder stored alongside each garment, so the wardrobe grid
 * paints the instant the page query returns — before any image is fetched, and
 * offline from the first sync.
 *
 * It lives in a Notion `rich_text` property, which caps a single content string
 * at 2000 characters. Two rounds of measurement decided the numbers below, and
 * the second overturned the first:
 *
 *   1. A Node/sharp spike suggested ~720 chars at 32px/q55 — a third of the cap.
 *   2. Measuring the ACTUAL path (the browser's own canvas JPEG encoder, which
 *      is what runs in production) told a different story. Base64 length, worst
 *      case across plain / noisy / adversarially-noisy 1200×1600 sources:
 *
 *          width    q0.4    q0.5
 *           16px    1204    1228
 *           20px    1336    1380
 *           24px    1288    1352
 *
 * The headline: at 16px a plain image already costs ~1060 chars, and at 24px it
 * costs ~1084. Size is dominated by FIXED OVERHEAD — canvas emits the full
 * standard JFIF header and Huffman tables every time — not by pixel data. So
 * shrinking the placeholder buys almost nothing, and 24px is effectively free
 * quality compared with 16px. Don't "optimise" this by going smaller; it won't
 * work, and the result just looks worse.
 *
 * Hence: 24px at q0.4, guarded at 1800. Worst measured output is 1288, so
 * there's real headroom, and the adversarial case is far noisier than any
 * photograph survives being downscaled to 24px.
 *
 * The average-colour fallback stays regardless, for three reasons: a
 * pathological image could still overrun, a tainted or unavailable canvas can't
 * produce a JPEG at all, and an encoder on some other browser may be less
 * efficient still. Falling back costs a duller placeholder, never an error —
 * which matters, because an oversized value doesn't just fail on its own, it
 * makes Notion reject the entire property patch.
 */

/** Notion's hard limit on one rich-text content string. */
export const NOTION_RICH_TEXT_CAP = 2000
/**
 * Our own ceiling, under Notion's. The gap absorbs an unusually noisy photo
 * without risking the 400 that would reject the whole property patch.
 */
export const LQIP_MAX_CHARS = 1800
export const LQIP_WIDTH = 24
export const LQIP_QUALITY = 0.4
/** Garment tiles render 3:4, so the placeholder is generated at that ratio. */
export const LQIP_ASPECT = 4 / 3

/** Mean colour of RGBA pixel data as `#rrggbb`. Fully transparent pixels are
 *  skipped — averaging them in drags every result toward black. */
export function averageColourHex(pixels: Uint8ClampedArray): string {
  let r = 0, g = 0, b = 0, n = 0
  for (let i = 0; i < pixels.length; i += 4) {
    const alpha = pixels[i + 3]
    if (alpha === 0) continue
    r += pixels[i]
    g += pixels[i + 1]
    b += pixels[i + 2]
    n++
  }
  if (n === 0) return '#cccccc'
  const hex = (v: number) => Math.round(v / n).toString(16).padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

/**
 * Decide what actually gets written to Notion. Pure, so the budget rule is
 * testable without a canvas — this is the guard that keeps a write from being
 * rejected, so it earns its own tests.
 */
export function chooseThumb(base64: string | null, fallbackHex: string): string {
  if (base64 && base64.length > 0 && base64.length <= LQIP_MAX_CHARS) return base64
  return fallbackHex
}

/** True if `thumb` is a base64 LQIP rather than an `#rrggbb` fallback. */
export function isLqip(thumb: string | null): boolean {
  return Boolean(thumb && !thumb.startsWith('#') && thumb.length > 32)
}

/**
 * Build the placeholder for a photo. Browser-only (canvas).
 *
 * Always returns something writable: if JPEG encoding fails or overruns the
 * budget, the average colour stands in.
 */
export async function makeThumb(blob: Blob): Promise<string> {
  const width = LQIP_WIDTH
  const height = Math.round(width * LQIP_ASPECT)

  const source = await loadImageSource(blob)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return '#cccccc'

  // `cover`, matching how the tile displays it, so the placeholder and the real
  // photo frame the garment identically and the swap isn't a visible jump.
  const sw = source.width
  const sh = source.height
  const scale = Math.max(width / sw, height / sh)
  const dw = sw * scale
  const dh = sh * scale
  ctx.drawImage(source, (width - dw) / 2, (height - dh) / 2, dw, dh)
  if ('close' in source) source.close()

  let fallback = '#cccccc'
  try {
    fallback = averageColourHex(ctx.getImageData(0, 0, width, height).data)
  } catch {
    // A tainted canvas throws here. The LQIP path below will fail the same way,
    // and chooseThumb falls back to this default grey.
  }

  const base64 = await canvasToBase64Jpeg(canvas)
  return chooseThumb(base64, fallback)
}

async function canvasToBase64Jpeg(canvas: HTMLCanvasElement): Promise<string | null> {
  try {
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', LQIP_QUALITY)
    })
    if (!blob) return null
    const buffer = await blob.arrayBuffer()
    let binary = ''
    const bytes = new Uint8Array(buffer)
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    return btoa(binary)
  } catch {
    return null
  }
}

async function loadImageSource(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(blob) } catch { /* fall through */ }
  }
  const url = URL.createObjectURL(blob)
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
