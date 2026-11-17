/**
 * Arma las imágenes de la ficha de Play Store desde las capturas de assets/store/raw (ver capture.mjs).
 * Renderiza HTML con Chrome headless. Uso: npm run store
 */
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const STORE = join(ROOT, 'assets/store')
const OUT = join(STORE, 'play')
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const url = (p) => pathToFileURL(join(STORE, p)).href

// Verdes del ícono (gráfico de funciones) y los tonos cálidos de la app (capturas, desde la 1.4.0).
const G = {
  green: ['#22c55e', '#15803d'],
  orange: ['#fb923c', '#c2410c'],
  violet: ['#a78bfa', '#5b21b6'],
  rose: ['#f472b6', '#be185d'],
  warmNight: ['#3a302a', '#151210'],
  forest: ['#16a34a', '#14532d'],
  teal: ['#14b8a6', '#0f766e'],
  sky: ['#38bdf8', '#1d4ed8'],
  amber: ['#f59e0b', '#c2410c'],
  night: ['#1f2a22', '#0e0f0e'],
}
const grad = (c) => `linear-gradient(160deg, ${G[c][0]}, ${G[c][1]})`

const SHOTS = [
  { file: '01-inicio', raw: 'home', color: 'orange', title: 'Toda tu colección en un lugar' },
  { file: '02-lista', raw: 'list', color: 'violet', title: 'Tus piezas, a la vista' },
  { file: '03-ficha', raw: 'form', color: 'sky', title: 'Cada pieza, con sus datos' },
  { file: '04-me-falta', raw: 'want', color: 'amber', title: 'Sabé siempre qué te falta' },
  { file: '05-mover', raw: 'select', color: 'rose', title: 'Reorganizá en dos toques' },
  { file: '06-oscuro', raw: 'dark', color: 'warmNight', title: 'Modo oscuro incluido' },
]

// Emojis de Noto (libres): los de Apple, que usaría Chrome en una Mac, no se pueden usar en la tienda.
const base = (w, h, body, css) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&family=Fraunces:opsz,wght@9..144,700&display=block"><style>
  * { box-sizing: border-box; margin: 0; }
  html, body { width: ${w}px; height: ${h}px; overflow: hidden; }
  body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Noto Color Emoji', sans-serif; color: #fff; position: relative; }
  .shine { position: absolute; border-radius: 50%; background: #fff; opacity: .14; }
  ${css}
</style></head><body>${body}</body></html>`

/** Captura de 1080×1920 (9:16): título arriba, teléfono abajo (la captura es de 1080×2400, sin barra de estado). */
const shotHtml = ({ raw, color, title }) =>
  base(1080, 1920, `
    <div class="shine" style="width:760px;height:760px;right:-260px;top:-300px"></div>
    <div class="shine" style="width:420px;height:420px;left:-200px;bottom:120px;opacity:.08"></div>
    <h1>${title}</h1>
    <div class="phone"><div class="screen"><img src="${url(`raw/${raw}.png`)}"></div></div>`, `
    body { background: ${grad(color)}; }
    h1 { position: absolute; top: 110px; left: 90px; right: 90px; text-align: center;
         font-family: Fraunces, Georgia, serif; font-size: 78px; line-height: 1.06; font-weight: 700; letter-spacing: -0.02em;
         text-shadow: 0 4px 24px rgba(0,0,0,.18); }
    .phone { position: absolute; left: 50%; top: 400px; transform: translateX(-50%);
             width: 686px; padding: 13px; border-radius: 76px; background: #16181a;
             box-shadow: 0 40px 80px -20px rgba(0,0,0,.45), 0 0 0 3px rgba(255,255,255,.12); }
    .screen { width: 660px; height: ${Math.round(660 * 2400 / 1080)}px; border-radius: 64px; overflow: hidden; }
    .screen img { display: block; width: 660px; }`)

/** Gráfico de funciones 1024×500: ícono + nombre + fichas con colecciones. */
const TILES = [
  ['👕', 'teal', 610, 40, -8], ['🃏', 'amber', 790, 70, 6], ['💿', 'sky', 690, 200, 4],
  ['🚗', 'forest', 870, 230, -6], ['🪙', 'amber', 600, 340, 7], ['🎟️', 'teal', 800, 360, -4],
]
const featureHtml = () =>
  base(1024, 500, `
    <div class="shine" style="width:520px;height:520px;right:-140px;top:-220px"></div>
    <div class="brand">
      <img class="icon" src="${url('icon-512.png')}">
      <h1>Coleccionables</h1>
      <p>Tu colección, ordenada.</p>
    </div>
    ${TILES.map(([e, c, x, y, r]) =>
      `<div class="tile" style="left:${x}px;top:${y}px;transform:rotate(${r}deg);background:${grad(c)}">${e}</div>`).join('')}`, `
    body { background: ${grad('green')}; }
    .brand { position: absolute; left: 64px; top: 50%; transform: translateY(-50%); }
    .icon { display: block; width: 128px; height: 128px; border-radius: 32px; box-shadow: 0 16px 36px -12px rgba(5,46,22,.6), 0 0 0 3px rgba(255,255,255,.25); }
    h1 { margin-top: 26px; font-size: 68px; line-height: 1; font-weight: 800; letter-spacing: -0.035em; }
    p { margin-top: 14px; font-size: 32px; font-weight: 600; opacity: .92; }
    .tile { position: absolute; width: 124px; height: 124px; border-radius: 34px; display: grid; place-items: center;
            font-size: 62px; box-shadow: 0 18px 30px -14px rgba(0,0,0,.5), 0 0 0 3px rgba(255,255,255,.25); }`)

async function render(html, w, h, out) {
  const dir = await mkdtemp(join(tmpdir(), 'coleccion-store-'))
  const page = join(dir, 'page.html')
  await writeFile(page, html)
  execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--allow-file-access-from-files', '--virtual-time-budget=10000',
    `--window-size=${w},${h}`, `--screenshot=${out}`, pathToFileURL(page).href,
  ], { stdio: 'ignore' })
  await rm(dir, { recursive: true })
}

await mkdir(OUT, { recursive: true })
for (const s of SHOTS) await render(shotHtml(s), 1080, 1920, join(OUT, `${s.file}.png`))
await render(featureHtml(), 1024, 500, join(OUT, 'feature-graphic.png'))
console.log('✔ Imágenes de la ficha en assets/store/play')
