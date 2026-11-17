/**
 * Capturas de la app para Play, con el backup de ejemplo: assets/store/raw/*.png (1080×2400).
 * Maneja Chrome headless por DevTools Protocol, con la pantalla de un teléfono (360×800 a 3x).
 * Uso: con `npm run dev` andando, node scripts/store/capture.mjs
 */
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const RAW = join(ROOT, 'assets/store/raw')
const APP = process.env.APP_URL ?? 'http://localhost:5180'
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9333
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const profile = await mkdtemp(join(tmpdir(), 'coleccion-store-'))
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`, '--window-size=360,800', 'about:blank',
], { stdio: 'ignore' })

async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      const page = targets.find((t) => t.type === 'page')
      if (page) return page.webSocketDebuggerUrl
    } catch { /* Chrome todavía arrancando */ }
    await sleep(200)
  }
  throw new Error('Chrome no respondió')
}

const ws = new WebSocket(await connect())
await new Promise((r) => ws.addEventListener('open', r, { once: true }))
let seq = 0
const pending = new Map()
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data)
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id)
    pending.delete(msg.id)
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)
  }
})
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params }))
  })

/** Corre JS en la página y devuelve el resultado. */
async function run(expression) {
  const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text)
  return result.value
}

async function waitFor(expression, ms = 15000) {
  for (let t = 0; t < ms; t += 200) {
    if (await run(expression).catch(() => false)) return
    await sleep(200)
  }
  throw new Error(`No apareció: ${expression}`)
}

async function open(path) {
  await send('Page.navigate', { url: APP + path })
  await waitFor(`!!document.querySelector('ion-router-outlet .ion-page:not(.ion-page-hidden) ion-content')`)
  await run(`document.fonts.load('32px "Noto Color Emoji"', '👕🃏💿🚗🪙🎟️📚').then(() => document.fonts.ready)`)
  await sleep(1200)
}

async function shot(name) {
  await sleep(600)
  const { data } = await send('Page.captureScreenshot', { format: 'png' })
  await writeFile(join(RAW, `${name}.png`), Buffer.from(data, 'base64'))
  console.log(`  ${name}.png`)
}

/**
 * Emojis de Noto (libres, los de Android) en vez de los del sistema: en una Mac saldrían los de Apple,
 * que no se pueden usar en material de la tienda.
 */
const NOTO = 'https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&display=block'
const EMOJI_FONT = `addEventListener('DOMContentLoaded', () => {
  const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: '${NOTO}' })
  const style = Object.assign(document.createElement('style'), {
    textContent: ":root { --ion-font-family: system-ui, -apple-system, Roboto, 'Noto Color Emoji', sans-serif }",
  })
  document.head.append(link, style)
})`

const scheme = (value) => send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value }] })

/** El container del front, para importar el backup como lo hace la app. */
const SERVICES = `(await import(performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('/src/app/container.ts')))).services()`

try {
  await mkdir(RAW, { recursive: true })
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Page.addScriptToEvaluateOnNewDocument', { source: EMOJI_FONT })
  await send('Emulation.setDeviceMetricsOverride', { width: 360, height: 800, deviceScaleFactor: 3, mobile: true })
  await scheme('light')

  await open('/')
  const listId = await run(`(async () => {
    const s = ${SERVICES}
    const text = await fetch('/assets/store/demo-backup.json').then((r) => r.text())
    await s.backup.applyImport(await s.backup.previewImport(text))
    return (await s.lists.all()).find((l) => l.name === 'Camisetas').id
  })()`)

  await open('/')
  await shot('home')

  await open(`/lists/${listId}`)
  await shot('list')

  // Formulario de una camiseta con foto, dorsal y precio.
  await run(`[...document.querySelectorAll('button.tile')].find((r) => r.textContent.includes('Argentina')).click()`)
  await waitFor(`!!document.querySelector('ion-modal.show-modal')`)
  await sleep(800)
  await shot('form')
  await run(`document.querySelector('ion-modal.show-modal').dismiss()`)
  await sleep(600)

  // Lo que falta.
  const status = (label) => run(`[...document.querySelectorAll('.chips .chip')].find((b) => b.textContent.startsWith('${label}')).click()`)
  await status('Me falta')
  await shot('want')
  await status('Todos')
  await sleep(500)

  // Elegir varias para moverlas (mantener apretada la primera, que en la grilla llega como contextmenu; tocar las otras).
  await run(`(() => {
    const tiles = [...document.querySelectorAll('button.tile')]
    const pick = (name) => tiles.find((r) => r.textContent.includes(name))
    pick('Alemania').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    for (const n of ['Argentina', 'Brasil', 'Dinamarca']) pick(n).click()
  })()`)
  await shot('select')

  await scheme('dark')
  await open(`/lists/${listId}`)
  await shot('dark')
  console.log('✔ Capturas en assets/store/raw')
} finally {
  ws.close()
  chrome.kill()
  await sleep(300)
  await rm(profile, { recursive: true, force: true })
}
