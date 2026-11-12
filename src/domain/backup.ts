/**
 * Formato de backup (JSON legible) + lógica pura de import.
 * Sin dependencias de storage ni de plataforma: se testea sola.
 *
 * Ejemplo mínimo válido, escrito a mano:
 *   { "lists": [{ "name": "Camisetas", "items": [{ "name": "Boca 2014", "year": 2014 }] }] }
 */
import { MAX_PHOTOS, type Authenticity, type Collection, type Id, type Item, type ItemStatus } from './models'
import { newId, nowIso } from './ids'
import { parseFields, type FieldConfig } from './fields'
import { normalizeUrl, parseAuthenticity, parseDay, parsePrice, parseStatus, parseYear } from './validation'
import { identityKey, uniqueName } from './identity'

export const BACKUP_APP = 'coleccion'
/** 2: suma "Tuve" y varias fotos. Una app vieja rechaza el archivo (pide actualizar) en vez de importar mal. */
export const BACKUP_VERSION = 2

export interface BackupItem {
  id: string
  name: string
  status: ItemStatus
  year: number | null
  version: string | null
  size: string | null
  /** "original" o "replica"; null = sin dato. */
  authenticity: Authenticity | null
  /** Dorsal, parches, firma… */
  customization: string | null
  url: string | null
  description: string | null
  price: number | null
  place: string | null
  /** Solo si status = gone (AAAA-MM-DD y motivo). */
  goneAt: string | null
  goneReason: string | null
  /** Campos propios de la lista, por id (ver `fields.custom` de la lista). */
  extra: Record<string, string | number>
  createdAt: string
  updatedAt: string
  /** Solo en el backup con fotos: miniatura y foto principal (data URLs JPEG)… */
  thumb?: string
  photo?: string
  /** …y las otras fotos, en orden. Va aparte para que una versión vieja de la app igual importe la principal. */
  morePhotos?: string[]
}

export interface BackupList {
  id: string
  name: string
  emoji: string
  fields: FieldConfig
  createdAt: string
  updatedAt: string
  items: BackupItem[]
}

export interface BackupFile {
  app: typeof BACKUP_APP
  version: typeof BACKUP_VERSION
  exportedAt: string
  withPhotos: boolean
  lists: BackupList[]
}

export class BackupError extends Error {}

// ---------- Export ----------

export function buildBackup(lists: Collection[], items: Item[], photos: Map<Id, string[]> | null): BackupFile {
  const byList = groupByList(items)
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: nowIso(),
    withPhotos: !!photos,
    lists: sortLists(lists).map((l) => ({
      id: l.id,
      name: l.name,
      emoji: l.emoji,
      fields: l.fields,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
      items: (byList.get(l.id) ?? []).map(({ listId: _l, thumb, ...i }) => {
        const [photo, ...more] = photos?.get(i.id) ?? []
        if (!photo || !thumb) return i
        return { ...i, thumb, photo, ...(more.length ? { morePhotos: more } : {}) }
      }),
    })),
  }
}

export const serializeBackup = (b: BackupFile) => JSON.stringify(b, null, 2) + '\n'

export function groupByList(items: Item[]) {
  const byList = new Map<Id, Item[]>()
  for (const i of items) byList.set(i.listId, [...(byList.get(i.listId) ?? []), i])
  return byList
}

export const sortLists = (lists: Collection[]) => [...lists].sort((a, b) => a.sortOrder - b.sortOrder)

// ---------- Parse (tolerante: completa lo que falte) ----------

/** Fechas faltantes quedan en "" para que nunca le ganen a datos locales. */
export interface ParsedItem extends Omit<BackupItem, 'id'> { id: string | null }
export interface ParsedList extends Omit<BackupList, 'id' | 'items'> { id: string | null; items: ParsedItem[] }

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null)
const date = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : '')
const extra = (v: unknown) => {
  const out: Record<string, string | number> = {}
  if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (typeof x === 'number' && Number.isFinite(x)) out[k] = x
      else if (typeof x === 'string' && x.trim()) out[k] = x.trim()
    }
  }
  return out
}
const image = (v: unknown) => (typeof v === 'string' && v.startsWith('data:image/') ? v : undefined)

/** Un dato inválido se descarta; no frena el import. */
function safe<T>(fn: () => T): T | null {
  try { return fn() } catch { return null }
}

export function parseBackup(text: string): ParsedList[] {
  let data: unknown
  try {
    data = JSON.parse(text.replace(/^﻿/, ''))
  } catch {
    throw new BackupError('El archivo no es un backup válido (no es JSON)')
  }
  if (!data || typeof data !== 'object' || !Array.isArray((data as { lists?: unknown }).lists)) {
    throw new BackupError('No encontramos listas en el archivo')
  }
  const { app, version } = data as { app?: unknown; version?: unknown }
  if (app !== undefined && app !== BACKUP_APP) throw new BackupError('Este archivo no es de Coleccionables')
  if (typeof version === 'number' && version > BACKUP_VERSION) {
    throw new BackupError('El backup es de una versión más nueva de la app. Actualizala y probá de nuevo.')
  }

  return (data as { lists: unknown[] }).lists.flatMap((raw): ParsedList[] => {
    const l = (raw ?? {}) as Record<string, unknown>
    const name = str(l.name)
    if (!name) return []
    const items = Array.isArray(l.items) ? l.items : []
    return [{
      id: str(l.id),
      name,
      emoji: str(l.emoji) ?? '👕',
      fields: parseFields(l.fields),
      createdAt: date(l.createdAt),
      updatedAt: date(l.updatedAt),
      items: items.flatMap((rawItem): ParsedItem[] => {
        const i = (rawItem ?? {}) as Record<string, unknown>
        const itemName = str(i.name)
        if (!itemName) return []
        const thumb = image(i.thumb)
        const photo = image(i.photo)
        const morePhotos = (Array.isArray(i.morePhotos) ? i.morePhotos : []).map(image).filter((p): p is string => !!p).slice(0, MAX_PHOTOS - 1)
        return [{
          id: str(i.id),
          name: itemName,
          status: parseStatus(i.status),
          goneAt: parseStatus(i.status) === 'gone' ? parseDay(i.goneAt) : null,
          goneReason: parseStatus(i.status) === 'gone' ? str(i.goneReason) : null,
          year: safe(() => parseYear(i.year as string | number | null)),
          version: str(i.version),
          size: str(i.size),
          authenticity: parseAuthenticity(i.authenticity),
          customization: str(i.customization),
          url: safe(() => normalizeUrl(str(i.url))),
          description: str(i.description),
          price: safe(() => parsePrice(i.price as string | number | null)),
          place: str(i.place),
          extra: extra(i.extra),
          createdAt: date(i.createdAt),
          updatedAt: date(i.updatedAt),
          // La foto solo sirve con su miniatura (la lista muestra la miniatura).
          ...(thumb && photo ? { thumb, photo, ...(morePhotos.length ? { morePhotos } : {}) } : {}),
        }]
      }),
    }]
  })
}

// ---------- Plan de merge ----------

export interface ImportWrite {
  item: Item
  /** undefined = no tocar las fotos que ya tenía. */
  photos?: string[]
}

/** Un ítem que está en el teléfono y en el backup con datos distintos: elige el usuario. */
export interface ImportConflict {
  list: Pick<Collection, 'name' | 'emoji' | 'fields'>
  phone: Item
  /** Cómo quedaría si se elige el del backup (con el id del teléfono). */
  backup: ImportWrite
  /** Lo que se propone de entrada: el editado más recientemente. */
  suggested: 'phone' | 'backup'
}

export interface ImportPlan {
  lists: Collection[]
  /** Lo que se escribe sin preguntar: ítems nuevos. */
  items: ImportWrite[]
  conflicts: ImportConflict[]
  summary: { listsAdded: number; itemsAdded: number; conflicts: number; unchanged: number; renamed: number }
}

const key = (s: string) => s.trim().toLocaleLowerCase()

/** Los datos que ve el usuario (no ids ni fechas internas). La foto cuenta solo si el backup trae una. */
function sameContent(phone: Item, incoming: Item, incomingThumb: string | undefined): boolean {
  const data = (i: Item) => JSON.stringify([
    i.name, i.status, i.year, i.version, i.size, i.authenticity, i.customization, i.url, i.description, i.price, i.place,
    Object.entries(i.extra).sort(([a], [b]) => a.localeCompare(b)), i.goneAt, i.goneReason,
  ])
  return data(phone) === data(incoming) && (!incomingThumb || incomingThumb === phone.thumb)
}

/**
 * Merge sin borrar nada local:
 * - Listas: por id; si no, por nombre.
 * - Ítems: por id; si no, por nombre + año + versión dentro de la lista (ver domain/identity.ts).
 * - Si coincide y los datos son iguales, no se toca. Si son distintos, es un conflicto: elige el usuario
 *   (se sugiere el editado más recientemente).
 * - Un ítem nuevo que repetiría nombre + año + versión en la lista entra como "… (2)".
 * - Un backup sin fotos nunca borra las fotos que ya tenés.
 */
export function planImport(incoming: ParsedList[], localLists: Collection[], localItems: Item[]): ImportPlan {
  const ts = nowIso()
  const summary = { listsAdded: 0, itemsAdded: 0, conflicts: 0, unchanged: 0, renamed: 0 }
  const outLists: Collection[] = []
  const outItems: ImportWrite[] = []
  const conflicts: ImportConflict[] = []

  const listsById = new Map(localLists.map((l) => [l.id, l]))
  const listsByName = new Map(localLists.map((l) => [key(l.name), l]))
  const itemsById = new Map(localItems.map((i) => [i.id, i]))
  // Por identidad solo se empareja con lo que ya había, y cada ítem local una sola vez:
  // si el teléfono tiene dos iguales (de antes de la regla), cada uno del archivo se empareja con uno.
  const itemsByKey = new Map<string, Item[]>()
  for (const i of localItems) {
    const k = i.listId + '\u0000' + identityKey(i)
    itemsByKey.set(k, [...(itemsByKey.get(k) ?? []), i])
  }
  const claimed = new Set<Id>()
  const byKey = (listId: Id, i: ParsedItem) => itemsByKey.get(listId + '\u0000' + identityKey(i))?.find((x) => !claimed.has(x.id))
  /** Identidades ocupadas por lista: lo local más lo nuevo que va entrando. */
  const taken = new Map<Id, Set<string>>()
  const takenIn = (listId: Id) => {
    if (!taken.has(listId)) taken.set(listId, new Set(localItems.filter((i) => i.listId === listId).map(identityKey)))
    return taken.get(listId)!
  }
  let sortOrder = Math.max(-1, ...localLists.map((l) => l.sortOrder))

  for (const inList of incoming) {
    const { items, ...listData } = inList
    const match = (listData.id && listsById.get(listData.id)) || listsByName.get(key(listData.name))
    let list: Collection

    if (match) {
      const newer = listData.updatedAt > match.updatedAt
      const base = newer ? { ...match, name: listData.name, emoji: listData.emoji, fields: listData.fields, updatedAt: listData.updatedAt } : match
      // Los campos propios se suman siempre: si no, los valores de esos campos quedarían invisibles.
      const known = new Set(base.fields.custom.map((f) => f.id))
      const missing = listData.fields.custom.filter((f) => !known.has(f.id))
      list = base
      if (newer || missing.length) {
        list = { ...base, fields: { ...base.fields, custom: [...base.fields.custom, ...missing] } }
        outLists.push(list)
        listsById.set(list.id, list)
      }
    } else {
      list = {
        ...listData,
        id: listData.id ?? newId(),
        sortOrder: ++sortOrder,
        createdAt: listData.createdAt || ts,
        updatedAt: listData.updatedAt || ts,
      }
      outLists.push(list)
      listsById.set(list.id, list)
      listsByName.set(key(list.name), list)
      summary.listsAdded++
    }
    const listId = list.id

    for (const { thumb, photo, morePhotos, ...inItem } of items) {
      const photos = photo ? [photo, ...(morePhotos ?? [])] : undefined
      const found = (inItem.id && itemsById.get(inItem.id)) || byKey(listId, inItem)
      if (found) {
        claimed.add(found.id)
        const item: Item = { ...inItem, id: found.id, listId, thumb: thumb ?? found.thumb, createdAt: found.createdAt }
        if (sameContent(found, item, thumb)) summary.unchanged++
        else {
          conflicts.push({ list, phone: found, backup: { item, photos }, suggested: inItem.updatedAt > found.updatedAt ? 'backup' : 'phone' })
          summary.conflicts++
        }
        continue
      }
      const used = takenIn(listId)
      const name = uniqueName(inItem, used)
      if (name !== inItem.name) summary.renamed++
      const item: Item = {
        ...inItem,
        name,
        id: inItem.id ?? newId(),
        listId,
        thumb: thumb ?? null,
        createdAt: inItem.createdAt || ts,
        updatedAt: inItem.updatedAt || ts,
      }
      used.add(identityKey(item))
      outItems.push({ item, photos })
      itemsById.set(item.id, item)
      claimed.add(item.id)
      summary.itemsAdded++
    }
  }

  return { lists: outLists, items: outItems, conflicts, summary }
}

/** Lo que se escribe al final: los nuevos más, de cada conflicto, el del backup si se eligió ese. */
export function resolveImport(plan: ImportPlan, choices: ('phone' | 'backup')[]): ImportWrite[] {
  return [...plan.items, ...plan.conflicts.flatMap((c, n) => ((choices[n] ?? c.suggested) === 'backup' ? [c.backup] : []))]
}
