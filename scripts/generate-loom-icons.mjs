// Rasterizes the Loom marks into the PWA icon set + favicon.
// Run with `npm run gen:loom-icons`. Re-run whenever either source SVG changes.
//
//   loom-icon.svg  — full-bleed teal/gold loom tile (launcher art)
//   loom-logo.svg  — thin gold line-mark on transparent (favicon)
//
//   loom-icon-192.png          — PWA any     ← icon.svg (tile)
//   loom-icon-512.png          — PWA any     ← icon.svg (tile)
//   loom-icon-512-maskable.png — PWA maskable ← icon.svg (bg bleeds to edge)
//   loom-favicon-32.png        — svg-favicon fallback ← logo.svg (line-mark)
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const pub = resolve(here, '..', 'public')
const iconSvg = await readFile(resolve(pub, 'loom-icon.svg'))
const logoSvg = await readFile(resolve(pub, 'loom-logo.svg'))

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

console.log('Generating Loom icons …')
await tile(192, 'loom-icon-192.png')
await tile(512, 'loom-icon-512.png')
await tile(512, 'loom-icon-512-maskable.png')
await favicon(32, 'loom-favicon-32.png')
console.log('Done.')
