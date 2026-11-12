/**
 * Contratos de persistencia. Servicios y vistas dependen SOLO de esto.
 * Para cambiar de fuente de datos se implementan estas interfaces y se cablean en app/container.ts.
 */
import type { Collection, CollectionWithCounts, Id, Item } from '@/domain/models'

export interface CollectionRepository {
  all(): Promise<CollectionWithCounts[]>
  get(id: Id): Promise<Collection | null>
  maxSortOrder(): Promise<number>
  insert(c: Collection): Promise<void>
  update(id: Id, patch: Partial<Collection>): Promise<void>
  /** Cada id toma su posición como sortOrder. */
  reorder(ids: Id[]): Promise<void>
  /** Borra la lista, sus ítems y sus fotos. */
  remove(id: Id): Promise<void>
  /** Para import. Inserta o pisa por id. */
  upsertMany(lists: Collection[]): Promise<void>
}

/** Un ítem a guardar con sus fotos grandes, en orden (la primera es la principal). undefined = no tocarlas; [] = sin fotos. */
export interface ItemWrite {
  item: Item
  photos?: string[]
}

export interface ItemRepository {
  all(): Promise<Item[]>
  byList(listId: Id): Promise<Item[]>
  get(id: Id): Promise<Item | null>
  /** Inserta o pisa por id. Con `photos` definido, también reemplaza sus fotos grandes. */
  save(item: Item, photos?: string[]): Promise<void>
  /** Varios en una sola transacción (import). */
  saveMany(writes: ItemWrite[]): Promise<void>
  /** Borrado definitivo: el ítem y sus fotos, sin dejar copia en la base. */
  remove(id: Id): Promise<void>
  /** Fotos grandes (data URLs), en orden; [] si no tiene. */
  photos(id: Id): Promise<string[]>
  /** Todas las fotos grandes, por id de ítem (export). */
  allPhotos(): Promise<Map<Id, string[]>>
  /** Valores distintos ya usados en una columna de la lista, más usados primero. */
  usedValues(field: 'version' | 'size' | 'place', listId: Id): Promise<string[]>
}

/** Key/value chico para flags de la app. */
export interface MetaRepository {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<void>
}
