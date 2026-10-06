import { defineStore } from 'pinia'
import { ref } from 'vue'
import { services } from '@/app/container'
import type { CollectionPatch, CollectionWithCounts, Id, NewCollectionInput } from '@/domain/models'

export const useListsStore = defineStore('lists', () => {
  const lists = ref<CollectionWithCounts[]>([])

  const byId = (id: Id) => lists.value.find((l) => l.id === id)

  async function load() {
    lists.value = await services().lists.all()
  }

  async function create(input: NewCollectionInput) {
    const list = await services().lists.create(input)
    await load()
    return list
  }

  async function update(id: Id, patch: CollectionPatch) {
    await services().lists.update(id, patch)
    await load()
  }

  /** Optimista: se ve el orden nuevo mientras se guarda. */
  async function reorder(ids: Id[]) {
    const pos = new Map(ids.map((id, i) => [id, i]))
    lists.value = [...lists.value].sort((a, b) => (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0))
    await services().lists.reorder(ids)
  }

  async function remove(id: Id) {
    await services().lists.remove(id)
    await load()
  }

  return { lists, byId, load, create, update, reorder, remove }
})
