/**
 * Fotos: sacar con la cámara o elegir de la galería, y comprimirlas en el teléfono.
 * Nativo usa @capacitor/camera; en web (desarrollo) un <input type=file>.
 */
import { Capacitor } from '@capacitor/core'
import { Camera, MediaTypeSelection } from '@capacitor/camera'
import type { Photo } from '@/domain/models'

export type PhotoSource = 'camera' | 'gallery'

/** Lado mayor de la foto grande y lado de la miniatura cuadrada (px). */
const FULL_PX = 1200
const THUMB_PX = 192
const FULL_QUALITY = 0.75
const THUMB_QUALITY = 0.7
/** Lo que pedimos al plugin: un poco más que FULL_PX, así no pasa la foto de 12 MP por el WebView. */
const NATIVE_PX = 1600

/** La cámara da una; de la galería se pueden elegir varias, hasta `max`. [] si el usuario cancela. */
export async function pickPhotos(source: PhotoSource, max: number): Promise<Photo[]> {
  const srcs = (Capacitor.isNativePlatform() ? await pickNative(source, max) : await pickWeb(source, max)).slice(0, max)
  try {
    const out: Photo[] = []
    // De a una: comprimir varias a la vez puede quedarse sin memoria en un teléfono modesto.
    for (const src of srcs) out.push(await compress(src))
    return out
  } finally {
    srcs.filter((s) => s.startsWith('blob:')).forEach((s) => URL.revokeObjectURL(s))
  }
}

/** Miniatura de una foto ya guardada (cuando otra pasa a ser la principal). */
export async function thumbOf(full: string): Promise<string> {
  const img = await loadImage(full)
  return squareThumb(img).toDataURL('image/jpeg', THUMB_QUALITY)
}

async function pickNative(source: PhotoSource, max: number): Promise<string[]> {
  const size = { quality: 85, targetWidth: NATIVE_PX, targetHeight: NATIVE_PX }
  try {
    if (source === 'camera') {
      const r = await Camera.takePhoto({ ...size, correctOrientation: true })
      return r.webPath ? [r.webPath] : []
    }
    const { results } = await Camera.chooseFromGallery({ ...size, mediaType: MediaTypeSelection.Photo, allowMultipleSelection: max > 1, limit: max })
    return results.flatMap((r) => (r.webPath ? [r.webPath] : []))
  } catch (e) {
    // Cerrar la cámara o la galería sin elegir no es un error.
    if (/cancel/i.test(String((e as Error)?.message ?? e))) return []
    throw e
  }
}

function pickWeb(source: PhotoSource, max: number): Promise<string[]> {
  return new Promise((resolve) => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/*', multiple: source === 'gallery' && max > 1 })
    if (source === 'camera') input.setAttribute('capture', 'environment')
    input.addEventListener('change', () => resolve([...(input.files ?? [])].map((f) => URL.createObjectURL(f))))
    input.addEventListener('cancel', () => resolve([]))
    input.click()
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo leer la imagen'))
    img.src = src
  })
}

/** Foto grande (lado mayor FULL_PX) + miniatura cuadrada recortada al centro. */
async function compress(src: string): Promise<Photo> {
  const img = await loadImage(src)
  const w = img.naturalWidth
  const h = img.naturalHeight

  const scale = Math.min(1, FULL_PX / Math.max(w, h))
  const full = draw(Math.round(w * scale), Math.round(h * scale), (ctx, cw, ch) => ctx.drawImage(img, 0, 0, cw, ch))

  return { full: full.toDataURL('image/jpeg', FULL_QUALITY), thumb: squareThumb(img).toDataURL('image/jpeg', THUMB_QUALITY) }
}

function squareThumb(img: HTMLImageElement) {
  const w = img.naturalWidth
  const h = img.naturalHeight
  const side = Math.min(w, h)
  return draw(THUMB_PX, THUMB_PX, (ctx) =>
    ctx.drawImage(img, (w - side) / 2, (h - side) / 2, side, side, 0, 0, THUMB_PX, THUMB_PX))
}

function draw(width: number, height: number, paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  const canvas = Object.assign(document.createElement('canvas'), { width, height })
  const ctx = canvas.getContext('2d')!
  // Fondo blanco: un PNG con transparencia no queda negro al pasar a JPEG.
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, width, height)
  ctx.imageSmoothingQuality = 'high'
  paint(ctx, width, height)
  return canvas
}
