import { defineStore } from 'pinia'
import { ref } from 'vue'
import { services } from '@/app/container'
import type { MoveSnapshot, PhotoChange } from '@/services/ItemService'
import type { Collection, Id, Item, ItemInput, ItemSnapshot, ItemStatus } from '@/domain/models'
import { useListsStore } from './lists'

export const useItemsStore = defineStore('items', () => {
  const byList = ref<Record<Id, Item[]>>({})
  /** Valores ya usados en la lista, para las sugerencias del formulario. */
  const used = ref<{ version: string[]; size: string[]; place: string[] }>({ version: [], size: [], place: [] })
  /** Todos los ítems, para la búsqueda global. null = no se cargaron. */
  const all = ref<Item[] | null>(null)

  async function loadAll() {
    all.value = await services().items.all()
  }

  async function load(listId: Id) {
    byList.value[listId] = await services().items.byList(listId)
  }

  async function loadUsed(listId: Id) {
    const s = services().items
    const [version, size, place] = await Promise.all(
      (['version', 'size', 'place'] as const).map((f) => s.usedValues(f, listId)),
    )
    used.value = { version, size, place }
  }

  /** Refresca la lista afectada, los contadores del home y la búsqueda global (si está en uso). */
  const refresh = (listId: Id) => Promise.all([load(listId), useListsStore().load(), all.value && loadAll()])

  /** Tras un import: invalida la caché, cada lista se recarga al abrirla. */
  function reset() {
    byList.value = {}
    all.value = null
  }

  async function create(list: Collection, input: ItemInput, photo: PhotoChange) {
    await services().items.create(list, input, photo)
    await refresh(list.id)
  }

  async function update(list: Collection, item: Item, input: ItemInput, photo: PhotoChange) {
    await services().items.update(list, item, input, photo)
    await refresh(item.listId)
  }

  async function setStatus(item: Item, status: ItemStatus) {
    await services().items.setStatus(item, status)
    await refresh(item.listId)
  }

  async function remove(item: Item): Promise<ItemSnapshot> {
    const snapshot = await services().items.remove(item)
    await refresh(item.listId)
    return snapshot
  }

  async function restore(snapshot: ItemSnapshot) {
    await services().items.restore(snapshot)
    await refresh(snapshot.item.listId)
  }

  async function move(moving: Item[], from: Collection, to: Collection): Promise<MoveSnapshot> {
    const snapshot = await services().items.move(moving, from, to)
    await Promise.all([refresh(from.id), load(to.id)])
    return snapshot
  }

  async function undoMove(snapshot: MoveSnapshot) {
    await services().items.undoMove(snapshot)
    const from = [...new Set(snapshot.items.map((i) => i.listId))]
    await Promise.all([refresh(snapshot.to), ...from.map(load)])
  }

  return { move, undoMove, byList, used, all, load, loadAll, reset, loadUsed, create, update, setStatus, remove, restore }
})
