import type { CollectionRepository } from '@/data/ports'
import type { Collection, CollectionPatch, Id, NewCollectionInput } from '@/domain/models'
import { newId, nowIso } from '@/domain/ids'
import { validateCollection } from '@/domain/validation'
import { defaultFields } from '@/domain/fields'

export class CollectionService {
  constructor(private lists: CollectionRepository) {}

  all() {
    return this.lists.all()
  }

  async create(input: NewCollectionInput): Promise<Collection> {
    const data = validateCollection(input)
    const ts = nowIso()
    const list: Collection = {
      ...data,
      fields: defaultFields(),
      id: newId(),
      sortOrder: (await this.lists.maxSortOrder()) + 1,
      createdAt: ts,
      updatedAt: ts,
    }
    await this.lists.insert(list)
    return list
  }

  update(id: Id, patch: CollectionPatch) {
    return this.lists.update(id, { ...validateCollection(patch), updatedAt: nowIso() })
  }

  /** No toca updatedAt: el orden es de este teléfono, no un cambio de la lista. */
  reorder(ids: Id[]) {
    return this.lists.reorder(ids)
  }

  remove(id: Id) {
    return this.lists.remove(id)
  }
}
