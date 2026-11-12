import type { CollectionRepository, ItemRepository } from '@/data/ports'
import { MAX_PHOTOS, type Collection, type Id, type Item, type ItemInput, type ItemStatus, type PhotoSet } from '@/domain/models'
import { newId, nowIso } from '@/domain/ids'
import { ValidationError, today, validateItem } from '@/domain/validation'
import { findClash, identityLabel } from '@/domain/identity'
import { planMove } from '@/domain/move'
import type { FieldConfig } from '@/domain/fields'

/** undefined = las fotos no cambian; PhotoSet = quedan estas (puede ser ninguna). */
export type PhotoChange = PhotoSet | undefined

const fullOf = (p: PhotoChange) => p?.full.slice(0, MAX_PHOTOS)
/** Sin fotos no hay miniatura, aunque venga una suelta. */
const thumbOf = (p: PhotoSet) => (p.full.length ? p.thumb : null)

/** Para "Deshacer" una mudanza: los ítems como estaban y los campos que tenía la lista destino. */
export interface MoveSnapshot {
  items: Item[]
  /** Cuántos entraron como "… (2)" porque ya había uno igual en la lista destino. */
  renamed: number
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

  photos(id: Id) {
    return this.items.photos(id)
  }

  /** Nombre + año + versión no se repiten en una lista (ver domain/identity.ts). */
  private async assertUnique(clean: Pick<Item, 'name' | 'year' | 'version'>, listId: Id, exceptId?: Id) {
    const clash = findClash(await this.items.byList(listId), { ...clean, listId }, exceptId)
    if (clash) throw new ValidationError('name', `Ya hay "${identityLabel(clash)}" en esta lista. Cambiá el nombre, el año o la versión.`)
  }

  async create(list: Collection, input: ItemInput, photo: PhotoChange): Promise<Item> {
    const ts = nowIso()
    const clean = validateItem(input, list.fields.custom)
    await this.assertUnique(clean, list.id)
    const item: Item = {
      ...clean,
      id: newId(),
      listId: list.id,
      thumb: photo ? thumbOf(photo) : null,
      createdAt: ts,
      updatedAt: ts,
    }
    await this.items.save(item, fullOf(photo))
    return item
  }

  async update(list: Collection, existing: Item, input: ItemInput, photo: PhotoChange): Promise<Item> {
    const clean = validateItem(input, list.fields.custom)
    await this.assertUnique(clean, existing.listId, existing.id)
    const item: Item = {
      ...existing,
      ...clean,
      extra: { ...orphanExtra(existing, list), ...clean.extra },
      thumb: photo === undefined ? existing.thumb : thumbOf(photo),
      updatedAt: nowIso(),
    }
    await this.items.save(item, fullOf(photo))
    return item
  }

  /** Pasar a "Tuve" desde acá le pone la fecha de hoy; salir de "Tuve" borra fecha y motivo (igual que el formulario). */
  setStatus(item: Item, status: ItemStatus) {
    const gone = status === 'gone'
    return this.items.save({
      ...item,
      status,
      goneAt: gone ? (item.goneAt ?? today()) : null,
      goneReason: gone ? item.goneReason : null,
      updatedAt: nowIso(),
    })
  }

  /** Definitivo, sin "Deshacer": no se guarda copia en ningún lado. */
  remove(item: Item) {
    return this.items.remove(item.id)
  }

  /** Pasa los ítems a otra lista, con su foto. Los campos propios con datos se suman a la lista destino. */
  async move(items: Item[], from: Collection, to: Collection): Promise<MoveSnapshot> {
    const ts = nowIso()
    const plan = planMove(items, from, to, ts, await this.items.byList(to.id))
    if (plan.fields) await this.lists.update(to.id, { fields: plan.fields, updatedAt: ts })
    await this.items.saveMany(plan.items.map((item) => ({ item })))
    const moved = new Set(plan.items.map((i) => i.id))
    return { items: items.filter((i) => moved.has(i.id)), renamed: plan.renamed, to: to.id, fields: plan.fields ? to.fields : null }
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
