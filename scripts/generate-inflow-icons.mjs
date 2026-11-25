// Rasterizes the InFlow marks into the PWA icon set + favicon.
// Run with `npm run gen:inflow-icons`. Re-run whenever either source SVG changes.
//
//   inflow-icon.svg  — deep green field, three rising bars and an amber wave (launcher art)
//   inflow-logo.svg  — bars and wave, on transparent (favicon)
//
//   inflow-icon-192.png          — PWA any      ← icon.svg
//   inflow-icon-512.png          — PWA any      ← icon.svg
//   inflow-icon-512-maskable.png — PWA maskable ← icon.svg, flattened
//   inflow-favicon-32.png        — svg-favicon fallback ← logo.svg
//
// The mark sits inside the central 80% safe zone, so the maskable crop keeps it whole.
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const pub = resolve(here, '..', 'public')
const iconSvg = await readFile(resolve(pub, 'inflow-icon.svg'))
const logoSvg = await readFile(resolve(pub, 'inflow-logo.svg'))

/** The darker stop of icon.svg's field gradient — what the corners flatten to. */
const FIELD = '#1e6b57'

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

console.log('Generating InFlow icons …')
await tile(192, 'inflow-icon-192.png')
await tile(512, 'inflow-icon-512.png')
await tile(512, 'inflow-icon-512-maskable.png', { squareOff: true })
await favicon(32, 'inflow-favicon-32.png')
console.log('Done.')
