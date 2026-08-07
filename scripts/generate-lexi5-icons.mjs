import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import sharp from 'sharp'

const here = dirname(fileURLToPath(import.meta.url))
const pub = resolve(here, '..', 'public')
const iconSvg = await readFile(resolve(pub, 'lexi5-icon.svg'))
const logoSvg = await readFile(resolve(pub, 'lexi5-logo.svg'))

const FIELD = '#6366f1'

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

console.log('Generating Lexi5 icons …')
await tile(192, 'lexi5-icon-192.png')
await tile(512, 'lexi5-icon-512.png')
await tile(512, 'lexi5-icon-512-maskable.png', { squareOff: true })
await favicon(32, 'lexi5-favicon-32.png')
console.log('Done.')
