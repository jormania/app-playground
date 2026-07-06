// Rasterizes the Yoru marks into the PWA icon set + favicon.
// Run with `npm run gen:yoru-icons`. Re-run whenever either source SVG changes.
//
//   yoru-icon.svg  — full-bleed dark tile with the 夜 glyph (launcher art)
//   yoru-logo.svg  — 夜 line-mark on transparent (favicon)
//
//   yoru-icon-192.png          — PWA any     ← icon.svg (tile)
//   yoru-icon-512.png          — PWA any     ← icon.svg (tile)
//   yoru-icon-512-maskable.png — PWA maskable ← icon.svg (bg bleeds to edge)
//   yoru-favicon-32.png        — svg-favicon fallback ← logo.svg (glyph)
//
// NOTE: the marks render the CJK glyph 夜 as SVG <text>, so this relies on a
// Japanese-capable system font being present for sharp/librsvg to rasterize.
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const pub = resolve(here, '..', 'public')
const iconSvg = await readFile(resolve(pub, 'yoru-icon.svg'))
const logoSvg = await readFile(resolve(pub, 'yoru-logo.svg'))

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

console.log('Generating Yoru icons …')
await tile(192, 'yoru-icon-192.png')
await tile(512, 'yoru-icon-512.png')
await tile(512, 'yoru-icon-512-maskable.png')
await favicon(32, 'yoru-favicon-32.png')
console.log('Done.')
