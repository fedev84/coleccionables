/**
 * Genera ícono y splash de Android desde scripts/assets/art.mjs.
 * Uso: npm run assets
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import * as art from './art.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const RES = join(ROOT, 'android/app/src/main/res')
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 }

// Del lienzo de 108dp, el launcher muestra los 72dp del centro.
const VISIBLE = Math.round(1024 * (72 / 108))
const INSET = Math.round((1024 - VISIBLE) / 2)

const render = (svg) => sharp(Buffer.from(svg)).png()
const mask = (size, shape) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${shape}</svg>`)

/** Ícono completo recortado al área visible, con forma (círculo o cuadrado redondeado). */
async function shaped(size, shape) {
  const visible = await render(art.full(1024))
    .extract({ left: INSET, top: INSET, width: VISIBLE, height: VISIBLE })
    .resize(size)
    .toBuffer()
  const s = shape === 'circle'
    ? `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/>`
    : `<rect width="${size}" height="${size}" rx="${size * 0.22}"/>`
  return sharp(visible).composite([{ input: mask(size, s), blend: 'dest-in' }]).png().toBuffer()
}

async function out(path, buffer) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, buffer)
}

for (const [name, d] of Object.entries(DENSITIES)) {
  const mipmap = join(RES, `mipmap-${name}`)
  const layer = Math.round(108 * d)
  const legacy = Math.round(48 * d)

  // Ícono adaptativo (Android 8+) y temático (Android 13+).
  await out(join(mipmap, 'ic_launcher_background.png'), await render(art.background(layer)).toBuffer())
  await out(join(mipmap, 'ic_launcher_foreground.png'), await render(art.foreground(layer)).toBuffer())
  await out(join(mipmap, 'ic_launcher_monochrome.png'), await render(art.monochrome(layer)).toBuffer())

  // Launchers viejos (Android 7).
  await out(join(mipmap, 'ic_launcher.png'), await shaped(legacy, 'rounded'))
  await out(join(mipmap, 'ic_launcher_round.png'), await shaped(legacy, 'circle'))

  // Splash (API de Android 12, retrocompatible vía core-splashscreen):
  // lienzo de 240dp con el ícono en un círculo de 160dp.
  const canvas = Math.round(240 * d)
  const circle = Math.round(160 * d)
  const icon = await shaped(circle, 'circle')
  await out(
    join(RES, `drawable-${name}`, 'splash_icon.png'),
    await sharp({ create: { width: canvas, height: canvas, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: icon, left: (canvas - circle) / 2, top: (canvas - circle) / 2 }])
      .png()
      .toBuffer(),
  )
}

// Play Store: 512×512 a sangre, la tienda aplica su propia máscara.
await out(join(ROOT, 'assets/store/icon-512.png'), await render(art.full(512)).toBuffer())

console.log('✔ Íconos y splash generados')
