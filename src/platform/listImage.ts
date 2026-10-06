/**
 * "Lo que me falta" como imagen: foto, nombre y año · versión · tamaño, como en la app.
 * Siempre en claro (se ve en el teléfono de otro). Varias imágenes si la lista es larga.
 */
import type { Collection, Item, ItemStatus } from '@/domain/models'
import { pages, shareInfo, shareTitle } from '@/domain/shareText'

const W = 1080
const PAD = 48
const ROW = 132
const THUMB = 108
const FONT = 'system-ui, -apple-system, Roboto, sans-serif'
const C = { bg: '#ffffff', text: '#18181b', muted: '#71717a', line: '#eceeec', empty: '#eceeec', accent: '#15803d' }

function loadImage(src: string): Promise<HTMLImageElement | null> {
  const img = new Image()
  img.src = src
  return img.decode().then(() => img, () => null)
}

/** Corta con "…" lo que no entra en el ancho. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text
  let s = text
  while (s && ctx.measureText(`${s}…`).width > max) s = s.slice(0, -1)
  return `${s.trimEnd()}…`
}

async function renderPage(list: Collection, chunk: Item[], title: string, pageLabel: string | null): Promise<string> {
  const headerH = PAD + 52 + (pageLabel ? 44 : 0) + 28
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = headerH + chunk.length * ROW + PAD
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, W, canvas.height)
  ctx.fillStyle = C.accent
  ctx.fillRect(0, 0, W, 12)

  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = C.text
  ctx.font = `700 44px ${FONT}`
  ctx.fillText(fit(ctx, title, W - PAD * 2), PAD, PAD + 44)
  if (pageLabel) {
    ctx.fillStyle = C.muted
    ctx.font = `400 30px ${FONT}`
    ctx.fillText(pageLabel, PAD, PAD + 52 + 36)
  }

  const thumbs = await Promise.all(chunk.map((i) => (i.thumb ? loadImage(i.thumb) : null)))
  const textX = PAD + THUMB + 28
  const textW = W - textX - PAD

  chunk.forEach((item, n) => {
    const y = headerH + n * ROW
    if (n > 0) {
      ctx.fillStyle = C.line
      ctx.fillRect(textX, y, W - textX, 2)
    }

    const ty = y + (ROW - THUMB) / 2
    ctx.save()
    ctx.beginPath()
    ctx.roundRect(PAD, ty, THUMB, THUMB, 16)
    ctx.clip()
    const img = thumbs[n]
    if (img) ctx.drawImage(img, PAD, ty, THUMB, THUMB)
    else {
      ctx.fillStyle = C.empty
      ctx.fillRect(PAD, ty, THUMB, THUMB)
      ctx.globalAlpha = 0.5
      ctx.font = `48px ${FONT}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(list.emoji, PAD + THUMB / 2, ty + THUMB / 2 + 2)
    }
    ctx.restore()

    const info = shareInfo(list, item)
    ctx.fillStyle = C.text
    ctx.font = `600 38px ${FONT}`
    ctx.fillText(fit(ctx, item.name, textW), textX, info ? y + 58 : y + ROW / 2 + 13)
    if (info) {
      ctx.fillStyle = C.muted
      ctx.font = `400 30px ${FONT}`
      ctx.fillText(fit(ctx, info, textW), textX, y + 100)
    }
  })

  return canvas.toDataURL('image/jpeg', 0.85)
}

/** Devuelve una imagen (JPEG en data URL) por cada tanda de ítems, en el orden recibido. */
export async function renderListImages(list: Collection, items: Item[], status: ItemStatus): Promise<string[]> {
  const chosen = items.filter((i) => i.status === status)
  const title = shareTitle(list, chosen.length, status)
  const chunks = pages(chosen)
  const out: string[] = []
  for (const [n, chunk] of chunks.entries()) {
    out.push(await renderPage(list, chunk, title, chunks.length > 1 ? `${n + 1} de ${chunks.length}` : null))
  }
  return out
}
