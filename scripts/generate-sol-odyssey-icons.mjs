// Rasterizes the compass mark (public/sol-odyssey-logo.svg) into the PWA icon set +
// favicon. Run with `npm run gen:icons`. Re-run whenever the logo changes.
//
//   sol-odyssey-icon-192.png        — PWA any
//   sol-odyssey-icon-512.png        — PWA any
//   sol-odyssey-icon-512-maskable.png — PWA maskable (safe-zone padding, indigo bg)
//   sol-odyssey-favicon-32.png      — favicon fallback for browsers that ignore SVG
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const pub = resolve(here, '..', 'public')
const svg = await readFile(resolve(pub, 'sol-odyssey-logo.svg'))

const BG = '#F7F7FC' // app canvas — the maskable safe-zone fill

async function plain(size, name) {
  const png = await sharp(svg, { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  await writeFile(resolve(pub, name), png)
  console.log('  ✓', name)
}

async function maskable(size, name) {
  // Maskable icons get cropped to ~80% by the OS, so inset the mark and fill the rest.
  const inner = Math.round(size * 0.78)
  const mark = await sharp(svg, { density: 384 })
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  const png = await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toBuffer()
  await writeFile(resolve(pub, name), png)
  console.log('  ✓', name)
}

console.log('Generating Sol Odyssey icons from sol-odyssey-logo.svg …')
await plain(192, 'sol-odyssey-icon-192.png')
await plain(512, 'sol-odyssey-icon-512.png')
await plain(32, 'sol-odyssey-favicon-32.png')
await maskable(512, 'sol-odyssey-icon-512-maskable.png')
console.log('Done.')
