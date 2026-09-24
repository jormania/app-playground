// Rasterizes the KeyPath marks into the PWA icon set + favicon.
// Run with `npm run gen:keypath-icons`. Re-run whenever either source SVG changes.
//
//   keypath-icon.svg  — full-bleed night-blue tile: five keys and a path to a star (launcher art)
//   keypath-logo.svg  — the same tile with rounded corners (favicon)
//
//   keypath-icon-192.png          — PWA any     ← icon.svg (tile)
//   keypath-icon-512.png          — PWA any     ← icon.svg (tile)
//   keypath-icon-512-maskable.png — PWA maskable ← icon.svg (bg bleeds to edge)
//   keypath-favicon-32.png        — svg-favicon fallback ← logo.svg (rounded tile)
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const pub = resolve(here, '..', 'public')
const iconSvg = await readFile(resolve(pub, 'keypath-icon.svg'))
const logoSvg = await readFile(resolve(pub, 'keypath-logo.svg'))

async function tile(size, name) {
  const png = await sharp(iconSvg, { density: 384 }).resize(size, size).png().toBuffer()
  await writeFile(resolve(pub, name), png)
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

console.log('Generating KeyPath icons …')
await tile(192, 'keypath-icon-192.png')
await tile(512, 'keypath-icon-512.png')
await tile(512, 'keypath-icon-512-maskable.png')
await favicon(32, 'keypath-favicon-32.png')
console.log('Done.')
