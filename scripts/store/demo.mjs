/**
 * Backup de ejemplo para las capturas de Play: assets/store/demo-backup.json.
 * Camisetas dibujadas (sin escudos ni marcas reales, para que la app no parezca de nadie) y listas de relleno.
 * Uso: node scripts/store/demo.mjs
 */
import { randomUUID } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { SHIRT } from '../assets/art.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')

// Diseños: color base + patrón dentro de la silueta de la camiseta.
const solid = (c) => `<rect width="1024" height="1024" fill="${c}"/>`
const vstripes = (a, b, n = 9) =>
  solid(a) + Array.from({ length: n }, (_, i) => (i % 2 ? `<rect x="${228 + i * (568 / n)}" y="0" width="${568 / n}" height="1024" fill="${b}"/>` : '')).join('')
const band = (base, colors) => solid(base) + colors.map((c, i) => `<rect x="0" y="${470 + i * 34}" width="1024" height="34" fill="${c}"/>`).join('')
const sash = (base, c) => solid(base) + `<path d="M 300 260 L 420 260 L 760 800 L 640 800 Z" fill="${c}"/>`
const halves = (a, b) => `<rect width="512" height="1024" fill="${a}"/><rect x="512" width="512" height="1024" fill="${b}"/>`
const hoops = (a, b) => solid(a) + Array.from({ length: 6 }, (_, i) => `<rect x="0" y="${300 + i * 90}" width="1024" height="45" fill="${b}"/>`).join('')

function shirtSvg(pattern, collar) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1024 1024">
    <defs>
      <clipPath id="s"><path d="${SHIRT}"/></clipPath>
      <radialGradient id="bg" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="#f4f5f2"/><stop offset="1" stop-color="#d9ddd6"/></radialGradient>
      <linearGradient id="shade" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".18"/>
      </linearGradient>
      <filter id="drop" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="14" stdDeviation="18" flood-opacity=".28"/></filter>
    </defs>
    <rect width="1024" height="1024" fill="url(#bg)"/>
    <g transform="translate(512 520) scale(1.12) translate(-512 -525)">
      <path d="${SHIRT}" fill="#cfd3cc" filter="url(#drop)"/>
      <g clip-path="url(#s)">${pattern}<rect width="1024" height="1024" fill="url(#shade)"/></g>
      <path d="M 430 260 Q 512 332 594 260" fill="none" stroke="${collar}" stroke-width="20" stroke-linecap="round"/>
    </g>
  </svg>`
}

async function photo(pattern, collar) {
  const png = await sharp(Buffer.from(shirtSvg(pattern, collar))).png().toBuffer()
  const full = await sharp(png).resize(1200).jpeg({ quality: 75 }).toBuffer()
  const thumb = await sharp(png).resize(192).jpeg({ quality: 70 }).toBuffer()
  return { photo: `data:image/jpeg;base64,${full.toString('base64')}`, thumb: `data:image/jpeg;base64,${thumb.toString('base64')}` }
}

let day = 0
/** Fechas escalonadas: el orden por "fecha de carga" se ve natural. */
const stamp = () => new Date(Date.UTC(2026, 6, 1 + day++)).toISOString()

const item = (name, extra) => {
  const ts = stamp()
  return {
    id: randomUUID(), name, status: 'have', year: null, version: null, size: null, authenticity: null, customization: null,
    url: null, description: null, price: null, place: null, extra: {}, createdAt: ts, updatedAt: ts, ...extra,
  }
}

const SHIRTS = [
  ['Argentina', 1986, 'Titular', 'L', vstripes('#ffffff', '#7cc5ef'), '#1f2a44', { customization: 'Dorsal 10', price: 85000, place: 'Feria de San Telmo' }],
  ['Países Bajos', 1974, 'Titular', 'M', solid('#f47a20'), '#ffffff', {}],
  ['Brasil', 1970, 'Titular', 'L', solid('#f7d417'), '#1b8a3a', { description: 'Retro, manga corta' }],
  ['Italia', 1990, 'Titular', 'L', solid('#1d5fb8'), '#ffffff', {}],
  ['Alemania', 1990, 'Titular', 'XL', band('#ffffff', ['#111111', '#d6262b', '#f2c318']), '#111111', { customization: 'Firmada' }],
  ['Uruguay', 1950, 'Titular', 'M', solid('#6fb6e8'), '#ffffff', { authenticity: 'replica' }],
  ['Perú', 1978, 'Titular', 'M', sash('#ffffff', '#d7262f'), '#d7262f', {}],
  ['Francia', 1998, 'Titular', 'L', solid('#1e3a8a'), '#ffffff', { customization: 'Parche de campeón' }],
  ['México', 1986, 'Titular', 'L', solid('#127a43'), '#ffffff', {}],
  ['Dinamarca', 1986, 'Titular', 'M', halves('#d81f2a', '#ffffff'), '#ffffff', {}],
  ['Escocia', 1978, 'Titular', 'L', solid('#1b2a52'), '#ffffff', {}],
  ['Inglaterra', 1966, 'Titular', 'L', solid('#f4f4f2'), '#1b2a52', { customization: 'Dorsal 9', authenticity: 'replica' }],
  ['Camerún', 1990, 'Titular', 'L', solid('#1b8a3a'), '#d7262f', { status: 'want' }],
  ['Chile', 1962, 'Titular', 'M', solid('#d52b1e'), '#ffffff', { status: 'want' }],
  ['Bélgica', 1986, 'Alternativa', 'L', hoops('#ffffff', '#d81f2a'), '#d81f2a', { status: 'want' }],
  ['Nigeria', 1994, 'Titular', 'L', vstripes('#1b8a3a', '#ffffff', 7), '#ffffff', { status: 'want' }],
  ['Colombia', 1990, 'Titular', 'L', solid('#f2c318'), '#1d4fa3', { status: 'want' }],
  ['Paraguay', 1998, 'Titular', 'M', vstripes('#ffffff', '#d52b1e', 7), '#1d4fa3', { status: 'want' }],
  ['Japón', 1998, 'Titular', 'L', solid('#1f3f99'), '#d52b1e', { status: 'want' }],
  ['Suecia', 1994, 'Titular', 'XL', solid('#f7d417'), '#1d5fb8', { status: 'want' }],
]

const camisetas = []
for (const [name, year, version, size, pattern, collar, extra] of SHIRTS) {
  camisetas.push(item(name, {
    year, version, size, authenticity: 'original', ...extra, ...(await photo(pattern, collar)),
  }))
}

const plain = (names, want = 0) => names.map((n, i) => item(n, i >= names.length - want ? { status: 'want' } : {}))
const ts = new Date(Date.UTC(2026, 6, 1)).toISOString()
const list = (name, emoji, items, fields = { hidden: [], labels: {}, custom: [] }) =>
  ({ id: randomUUID(), name, emoji, fields, createdAt: ts, updatedAt: ts, items })

const backup = {
  app: 'coleccion',
  version: 1,
  exportedAt: new Date().toISOString(),
  withPhotos: true,
  lists: [
    list('Camisetas', '👕', camisetas),
    list('Figuritas Mundial 78', '🃏', plain(Array.from({ length: 48 }, (_, i) => `Figurita ${i + 1}`), 9), { hidden: ['size', 'authenticity', 'customization'], labels: {}, custom: [] }),
    list('Vinilos', '💿', plain(['Tango de madrugada', 'Noches de verano', 'Rock del sur', 'Folklore vivo', 'Jazz en el puerto', 'Canciones del río', 'Ruta 40', 'Luces de ciudad'], 2)),
    list('Autitos a escala', '🚗', plain(['Coupé 1:43 roja', 'Rural 1:43', 'Fórmula 1:18', 'Colectivo 1:64', 'Camioneta 1:43', 'Sport 1:24'], 1)),
    list('Monedas', '🪙', plain(Array.from({ length: 23 }, (_, i) => `Moneda ${i + 1}`), 5)),
    list('Entradas de partidos', '🎟️', plain(Array.from({ length: 14 }, (_, i) => `Entrada ${i + 1}`))),
    list('Libros de fútbol', '📚', plain(['Historia de los mundiales', 'Crónicas de potrero', 'El arquero', 'Tácticas del 70', 'Goles inolvidables'], 2)),
  ],
}

await writeFile(join(ROOT, 'assets/store/demo-backup.json'), JSON.stringify(backup, null, 2) + '\n')
console.log('✔ assets/store/demo-backup.json')
