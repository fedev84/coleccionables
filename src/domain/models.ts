/** Entidades de dominio. Sin dependencias de framework ni de storage. */
import type { Id } from './ids'
import type { FieldConfig } from './fields'

export type { Id }
/** ISO-8601 (UTC). Strings para que serialicen igual en SQLite, JSON y export. */
export type Timestamp = string

export interface Collection {
  id: Id
  name: string
  emoji: string
  /** Qué campos usa la lista (ver domain/fields.ts). */
  fields: FieldConfig
  sortOrder: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** have = lo tengo; want = me falta. */
export type ItemStatus = 'have' | 'want'

export type Authenticity = 'original' | 'replica'

export interface Item {
  id: Id
  listId: Id
  name: string
  status: ItemStatus
  year: number | null
  version: string | null
  size: string | null
  authenticity: Authenticity | null
  /** Lo que se le agregó: dorsal, parches, firma… Texto libre. */
  customization: string | null
  url: string | null
  description: string | null
  price: number | null
  place: string | null
  /** Valores de los campos propios de la lista, por id de campo. */
  extra: Record<string, string | number>
  /** Miniatura JPEG (data URL) para la lista. La foto grande va aparte (ver ItemRepository.photo). */
  thumb: string | null
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface CollectionWithCounts extends Collection {
  have: number
  want: number
}

export type NewCollectionInput = Pick<Collection, 'name' | 'emoji'>
export type CollectionPatch = Partial<NewCollectionInput & Pick<Collection, 'fields'>>

/** Lo que se carga en el formulario. El año llega como texto desde el input. */
export interface ItemInput {
  name: string
  status: ItemStatus
  year: string | number | null
  version: string | null
  size: string | null
  url: string | null
  description: string | null
  price?: string | number | null
  place?: string | null
  authenticity?: Authenticity | null
  customization?: string | null
  /** Por id de campo propio; llegan como texto desde los inputs. */
  extra?: Record<string, string | number>
}

/** Foto ya comprimida: la grande y su miniatura (data URLs JPEG). */
export interface Photo {
  full: string
  thumb: string
}

/** Para "Deshacer" un borrado: el ítem y su foto. */
export interface ItemSnapshot {
  item: Item
  photo: string | null
}
