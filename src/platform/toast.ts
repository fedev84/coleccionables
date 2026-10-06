import { toastController } from '@ionic/vue'

/** Aviso corto abajo, con "Deshacer" opcional. */
export async function toast(message: string, undo?: () => void) {
  const el = await toastController.create({
    message,
    duration: 2500,
    position: 'bottom',
    buttons: undo ? [{ text: 'Deshacer', handler: undo }] : [],
  })
  await el.present()
}
