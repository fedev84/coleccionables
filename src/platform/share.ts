/** Compartir texto: nativo abre el share sheet (WhatsApp, mail…); en web, el share del navegador o el portapapeles. */
import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'

/** Devuelve 'copied' si en vez de compartir lo copió al portapapeles. */
export async function shareText(text: string, dialogTitle: string): Promise<'shared' | 'copied'> {
  try {
    if (Capacitor.isNativePlatform()) await Share.share({ text, dialogTitle })
    else if (navigator.share) await navigator.share({ text })
    else {
      await navigator.clipboard.writeText(text)
      return 'copied'
    }
  } catch (e) {
    // Cerrar el share sheet sin elegir nada no es un error.
    if (!/cancel|abort/i.test(String((e as Error)?.message ?? (e as Error)?.name ?? e))) throw e
  }
  return 'shared'
}
