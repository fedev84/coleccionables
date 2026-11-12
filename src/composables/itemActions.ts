/** Cambiar tengo/falta (con "Deshacer") y borrar (definitivo, con aviso). Lo usan la lista, la búsqueda global y la ficha. */
import { alertController } from '@ionic/vue'
import type { Item } from '@/domain/models'
import { toast } from '@/platform/toast'
import { useItemsStore } from '@/stores/items'
import { t } from '@/copy/es'

export function useItemActions() {
  const items = useItemsStore()

  async function toggle(item: Item) {
    const status = item.status === 'want' ? 'have' : 'want'
    await items.setStatus(item, status)
    toast(status === 'have' ? t.list.nowHave(item.name) : t.list.nowWant(item.name), () => items.setStatus({ ...item, status }, item.status))
  }

  /** Pregunta antes y no tiene "Deshacer": borrado, no queda copia. Devuelve si se borró. */
  async function remove(item: Item): Promise<boolean> {
    const alert = await alertController.create({
      header: t.item.deleteTitle(item.name),
      message: t.item.deleteBody,
      buttons: [
        { text: t.common.cancel, role: 'cancel' },
        { text: t.common.delete, role: 'destructive', cssClass: 'danger' },
      ],
    })
    await alert.present()
    const { role } = await alert.onDidDismiss()
    if (role !== 'destructive') return false
    try {
      await items.remove(item)
      toast(t.list.deleted)
      return true
    } catch (e) {
      console.error(e)
      toast(t.item.deleteError)
      return false
    }
  }

  return { toggle, remove }
}
