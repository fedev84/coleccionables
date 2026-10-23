import type { CollectionRepository, ItemRepository } from '@/data/ports'
import type { Collection, Id, Item, ItemInput, ItemSnapshot, ItemStatus, Photo } from '@/domain/models'
import { newId, nowIso } from '@/domain/ids'
import { validateItem } from '@/domain/validation'
import { planMove } from '@/domain/move'
import type { FieldConfig } from '@/domain/fields'

/** `photo`: undefined = no cambia, null = se saca, Photo = foto nueva. */
export type PhotoChange = Photo | null | undefined

/** Para "Deshacer" una mudanza: los ítems como estaban y los campos que tenía la lista destino. */
export interface MoveSnapshot {
  items: Item[]
  to: Id
  fields: FieldConfig | null
}

export class ItemService {
  constructor(private items: ItemRepository, private lists: CollectionRepository) {}

  all() {
    return this.items.all()
  }

  byList(listId: Id) {
    return this.items.byList(listId)
  }

  photo(id: Id) {
    return this.items.photo(id)
  }

  async create(list: Collection, input: ItemInput, photo: PhotoChange): Promise<Item> {
    const ts = nowIso()
    const item: Item = {
      ...validateItem(input, list.fields.custom),
      id: newId(),
      listId: list.id,
      thumb: photo?.thumb ?? null,
      createdAt: ts,
      updatedAt: ts,
    }
    await this.items.save(item, photo ? photo.full : undefined)
    return item
  }

  async update(list: Collection, existing: Item, input: ItemInput, photo: PhotoChange): Promise<Item> {
    const clean = validateItem(input, list.fields.custom)
    const item: Item = {
      ...existing,
      ...clean,
      extra: { ...orphanExtra(existing, list), ...clean.extra },
      thumb: photo === undefined ? existing.thumb : (photo?.thumb ?? null),
      updatedAt: nowIso(),
    }
    await this.items.save(item, photo === undefined ? undefined : (photo?.full ?? null))
    return item
  }

  setStatus(item: Item, status: ItemStatus) {
    return this.items.save({ ...item, status, updatedAt: nowIso() })
  }

  /** Devuelve lo necesario para "Deshacer". */
  async remove(item: Item): Promise<ItemSnapshot> {
    const photo = await this.items.photo(item.id)
    await this.items.remove(item.id)
    return { item, photo }
  }

  restore({ item, photo }: ItemSnapshot) {
    return this.items.save(item, photo)
  }

  /** Pasa los ítems a otra lista, con su foto. Los campos propios con datos se suman a la lista destino. */
  async move(items: Item[], from: Collection, to: Collection): Promise<MoveSnapshot> {
    const ts = nowIso()
    const plan = planMove(items, from, to, ts)
    if (plan.fields) await this.lists.update(to.id, { fields: plan.fields, updatedAt: ts })
    await this.items.saveMany(plan.items.map((item) => ({ item })))
    const moved = new Set(plan.items.map((i) => i.id))
    return { items: items.filter((i) => moved.has(i.id)), to: to.id, fields: plan.fields ? to.fields : null }
  }

  async undoMove({ items, to, fields }: MoveSnapshot) {
    await this.items.saveMany(items.map((item) => ({ item })))
    if (fields) await this.lists.update(to, { fields, updatedAt: nowIso() })
  }

  usedValues(field: 'version' | 'size' | 'place', listId: Id) {
    return this.items.usedValues(field, listId)
  }
}

/** Valores de campos que la lista ya no tiene: se conservan, por si el campo vuelve (p. ej. tras un import). */
function orphanExtra(item: Item, list: Collection): Item['extra'] {
  const current = new Set(list.fields.custom.map((f) => f.id))
  return Object.fromEntries(Object.entries(item.extra).filter(([k]) => !current.has(k)))
}
