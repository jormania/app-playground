// Rasterizes the Fit Check marks into the PWA icon set + favicon.
// Run with `npm run gen:fit-check-icons`. Re-run whenever either source SVG changes.
//
//   fit-check-icon.svg  — full-bleed sparkle tile over seigaiha (launcher art)
//   fit-check-logo.svg  — sparkle mark on transparent (favicon)
//
//   fit-check-icon-192.png          — PWA any      ← icon.svg (rounded tile)
//   fit-check-icon-512.png          — PWA any      ← icon.svg (rounded tile)
//   fit-check-icon-512-maskable.png — PWA maskable ← icon.svg, corners filled
//   fit-check-favicon-32.png        — svg-favicon fallback ← logo.svg (mark)
//
// icon.svg has ROUNDED corners (Nora's sketch), so it carries transparent
// wedges. That's right for the `any` icons and wrong for the maskable one,
// where Android composites the art into its own shape and would expose those
// wedges as notches. So the maskable is flattened onto the field colour first,
// squaring it off. Everything meaningful already sits inside the safe circle,
// so the fill is only ever visible in the corners a mask discards anyway.
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const pub = resolve(here, '..', 'public')
const iconSvg = await readFile(resolve(pub, 'fit-check-icon.svg'))
const logoSvg = await readFile(resolve(pub, 'fit-check-logo.svg'))

/** The darkest stop of icon.svg's field gradient — what the corners flatten to. */
const FIELD = '#100b16'

async function tile(size, name, { squareOff = false } = {}) {
  let pipeline = sharp(iconSvg, { density: 384 }).resize(size, size)
  if (squareOff) pipeline = pipeline.flatten({ background: FIELD })
  await writeFile(resolve(pub, name), await pipeline.png().toBuffer())
  console.log('  ✓', name)
}

async function favicon(size, name) {
  const png = await sharp(logoSvg, { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  await writeFile(resolve(pub, name), png)
  console.log('  ✓', name)
}

console.log('Generating Fit Check icons …')
await tile(192, 'fit-check-icon-192.png')
await tile(512, 'fit-check-icon-512.png')
await tile(512, 'fit-check-icon-512-maskable.png', { squareOff: true })
await favicon(32, 'fit-check-favicon-32.png')
console.log('Done.')
