import { defineStore } from 'pinia'
import { ref } from 'vue'
import { services } from '@/app/container'
import type { Id } from '@/domain/models'
import { DEFAULT_VIEW, parseView, type ListView } from '@/domain/query'

/** Filtro y orden elegidos en cada lista. Se guardan en este teléfono (no van al backup). */
export const useViewsStore = defineStore('views', () => {
  const byList = ref<Record<Id, ListView>>({})

  const key = (listId: Id) => `view:${listId}`

  async function load(listId: Id) {
    if (!byList.value[listId]) byList.value[listId] = parseView(await services().meta.get(key(listId)))
  }

  const get = (listId: Id): ListView => byList.value[listId] ?? DEFAULT_VIEW

  async function set(listId: Id, patch: Partial<ListView>) {
    const view = { ...get(listId), ...patch }
    byList.value[listId] = view
    await services().meta.set(key(listId), JSON.stringify(view))
  }

  return { load, get, set }
})
