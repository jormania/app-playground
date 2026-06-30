// Rasterizes the Sol Odyssey marks into the PWA icon set + favicon.
// Run with `npm run gen:icons`. Re-run whenever either source SVG changes.
//
// Two sources, matching how the sibling apps split launcher art from in-app logo:
//   sol-odyssey-icon.svg  — full-bleed dark-tile compass (home-screen / launcher art,
//                           same family as touch-grass-icon.svg / journal-icon.svg)
//   sol-odyssey-logo.svg  — thin line-mark on transparent (in-app header + favicon)
//
//   sol-odyssey-icon-192.png        — PWA any        ← icon.svg (dark tile)
//   sol-odyssey-icon-512.png        — PWA any        ← icon.svg (dark tile)
//   sol-odyssey-icon-512-maskable.png — PWA maskable ← icon.svg (bg bleeds to edge)
//   sol-odyssey-favicon-32.png      — svg-favicon fallback ← logo.svg (line-mark)
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const pub = resolve(here, '..', 'public')
const iconSvg = await readFile(resolve(pub, 'sol-odyssey-icon.svg'))
const logoSvg = await readFile(resolve(pub, 'sol-odyssey-logo.svg'))

// The launcher icon is full-bleed (its own dark background), so it rasterizes edge to
// edge — no padding, no composited fill. The compass + bezel sit inside the maskable
// safe zone, so the same art serves "any" and "maskable"; only the corners get cropped.
async function tile(size, name) {
  const png = await sharp(iconSvg, { density: 384 }).resize(size, size).png().toBuffer()
  await writeFile(resolve(pub, name), png)
  console.log('  ✓', name)
}

// Favicon keeps the transparent line-mark, for the light/dark browser-tab context.
async function favicon(size, name) {
  const png = await sharp(logoSvg, { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
  await writeFile(resolve(pub, name), png)
  console.log('  ✓', name)
}

console.log('Generating Sol Odyssey icons …')
await tile(192, 'sol-odyssey-icon-192.png')
await tile(512, 'sol-odyssey-icon-512.png')
await tile(512, 'sol-odyssey-icon-512-maskable.png')
await favicon(32, 'sol-odyssey-favicon-32.png')
console.log('Done.')
