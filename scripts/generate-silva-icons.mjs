// Rasterizes the Silva marks into the PWA icon set + favicon.
// Run with `npm run gen:silva-icons`. Re-run whenever either source SVG changes.
//
//   silva-icon.svg  — forest-green field with a layered pine mark (launcher art)
//   silva-logo.svg  — the pine mark alone, on transparent (favicon)
//
//   silva-icon-192.png          — PWA any      ← icon.svg
//   silva-icon-512.png          — PWA any      ← icon.svg
//   silva-icon-512-maskable.png — PWA maskable ← icon.svg, flattened
//   silva-favicon-32.png        — svg-favicon fallback ← logo.svg
//
// icon.svg is a plain square with no transparent corners, so the maskable
// variant doesn't strictly need flattening — done anyway (same technique as
// Fit Check's script) so a future non-square redesign stays safe by default.
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const pub = resolve(here, '..', 'public')
const iconSvg = await readFile(resolve(pub, 'silva-icon.svg'))
const logoSvg = await readFile(resolve(pub, 'silva-logo.svg'))

/** The darkest stop of icon.svg's field gradient — what the corners flatten to. */
const FIELD = '#123324'

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

console.log('Generating Silva icons …')
await tile(192, 'silva-icon-192.png')
await tile(512, 'silva-icon-512.png')
await tile(512, 'silva-icon-512-maskable.png', { squareOff: true })
await favicon(32, 'silva-favicon-32.png')
console.log('Done.')
