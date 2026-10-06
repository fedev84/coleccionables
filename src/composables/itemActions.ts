/** Cambiar tengo/falta y borrar, con "Deshacer". Lo usan la lista y la búsqueda global. */
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

  async function remove(item: Item) {
    const snapshot = await items.remove(item)
    toast(t.list.deleted, () => items.restore(snapshot))
  }

  return { toggle, remove }
}
