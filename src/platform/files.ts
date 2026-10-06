/**
 * Entrada/salida de archivos de texto. Aislado para poder cambiar la estrategia
 * (share sheet, guardar en Documentos, Drive, etc.) sin tocar vistas ni servicios.
 */
import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

/** El backup con fotos puede pesar decenas de MB: se escribe de a pedazos para no ahogar el puente nativo. */
const CHUNK = 1_000_000

function* chunks(text: string) {
  for (let i = 0; i < text.length;) {
    let end = Math.min(i + CHUNK, text.length)
    // No cortar un emoji (par sustituto) al medio.
    const c = text.charCodeAt(end - 1)
    if (end < text.length && c >= 0xd800 && c <= 0xdbff) end--
    yield text.slice(i, end)
    i = end
  }
}

/** Nativo: escribe en caché y abre el share sheet (Drive, Archivos, WhatsApp, mail…). Web: descarga. */
export async function shareTextFile(filename: string, content: string, mime: string, dialogTitle: string) {
  if (!Capacitor.isNativePlatform()) {
    const url = URL.createObjectURL(new Blob([content], { type: mime }))
    const a = Object.assign(document.createElement('a'), { href: url, download: filename })
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return
  }
  const target = { path: filename, directory: Directory.Cache, encoding: Encoding.UTF8 }
  let first = true
  for (const data of chunks(content)) {
    await (first ? Filesystem.writeFile({ ...target, data }) : Filesystem.appendFile({ ...target, data }))
    first = false
  }
  const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache })
  try {
    await Share.share({ title: filename, files: [uri], dialogTitle })
  } catch (e) {
    // Cerrar el share sheet sin elegir nada no es un error.
    if (!/cancel/i.test(String((e as Error)?.message ?? e))) throw e
  }
}

/** Comparte imágenes (data URLs JPEG). Nativo: share sheet. Web: share del navegador si acepta archivos; si no, descarga. */
export async function shareImages(names: string[], dataUrls: string[], dialogTitle: string) {
  const base64 = dataUrls.map((d) => d.slice(d.indexOf(',') + 1))
  try {
    if (Capacitor.isNativePlatform()) {
      const files: string[] = []
      for (const [n, data] of base64.entries()) {
        await Filesystem.writeFile({ path: names[n], data, directory: Directory.Cache })
        files.push((await Filesystem.getUri({ path: names[n], directory: Directory.Cache })).uri)
      }
      await Share.share({ files, dialogTitle })
      return
    }
    const blobs = await Promise.all(dataUrls.map((d) => fetch(d).then((r) => r.blob())))
    const files = blobs.map((b, n) => new File([b], names[n], { type: 'image/jpeg' }))
    if (navigator.canShare?.({ files })) return await navigator.share({ files })
    for (const [n, b] of blobs.entries()) {
      const url = URL.createObjectURL(b)
      Object.assign(document.createElement('a'), { href: url, download: names[n] }).click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
  } catch (e) {
    // Cerrar el share sheet sin elegir nada no es un error.
    if (!/cancel|abort/i.test(String((e as Error)?.message ?? (e as Error)?.name ?? e))) throw e
  }
}

/**
 * Abre el selector de archivos del sistema y devuelve el texto (null si cancela).
 * Usa <input type=file>: Capacitor lo conecta al picker nativo de Android.
 */
export function pickTextFile(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = Object.assign(document.createElement('input'), { type: 'file' })
    // Sin `accept`: en Android muchos .json llegan como octet-stream y quedarían filtrados.
    input.addEventListener('change', () => {
      const file = input.files?.[0]
      if (!file) return resolve(null)
      file.text().then(resolve, reject)
    })
    input.addEventListener('cancel', () => resolve(null))
    input.click()
  })
}
