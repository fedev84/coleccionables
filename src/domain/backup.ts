/**
 * Formato de backup (JSON legible) + lógica pura de import.
 * Sin dependencias de storage ni de plataforma: se testea sola.
 *
 * Ejemplo mínimo válido, escrito a mano:
 *   { "lists": [{ "name": "Camisetas", "items": [{ "name": "Boca 2014", "year": 2014 }] }] }
 */
import type { Collection, Id, Item, ItemStatus } from './models'
import { newId, nowIso } from './ids'
import { parseFields, type FieldConfig } from './fields'
import { normalizeUrl, parsePrice, parseYear } from './validation'

export const BACKUP_APP = 'coleccion'
export const BACKUP_VERSION = 1

export interface BackupItem {
  id: string
  name: string
  status: ItemStatus
  year: number | null
  version: string | null
  size: string | null
  url: string | null
  description: string | null
  price: number | null
  place: string | null
  /** Campos propios de la lista, por id (ver `fields.custom` de la lista). */
  extra: Record<string, string | number>
  createdAt: string
  updatedAt: string
  /** Solo en el backup con fotos: miniatura y foto grande (data URLs JPEG). */
  thumb?: string
  photo?: string
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

export function buildBackup(lists: Collection[], items: Item[], photos: Map<Id, string> | null): BackupFile {
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
        const photo = photos?.get(i.id)
        return photo && thumb ? { ...i, thumb, photo } : i
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
  if (app !== undefined && app !== BACKUP_APP) throw new BackupError('Este archivo no es de Colección')
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
        return [{
          id: str(i.id),
          name: itemName,
          status: i.status === 'want' ? 'want' : 'have',
          year: safe(() => parseYear(i.year as string | number | null)),
          version: str(i.version),
          size: str(i.size),
          url: safe(() => normalizeUrl(str(i.url))),
          description: str(i.description),
          price: safe(() => parsePrice(i.price as string | number | null)),
          place: str(i.place),
          extra: extra(i.extra),
          createdAt: date(i.createdAt),
          updatedAt: date(i.updatedAt),
          // La foto solo sirve con su miniatura (la lista muestra la miniatura).
          ...(thumb && photo ? { thumb, photo } : {}),
        }]
      }),
    }]
  })
}

// ---------- Plan de merge ----------

export interface ImportWrite {
  item: Item
  /** undefined = no tocar la foto que ya tenía. */
  photo?: string
}

export interface ImportPlan {
  lists: Collection[]
  items: ImportWrite[]
  summary: { listsAdded: number; itemsAdded: number; itemsUpdated: number; unchanged: number }
}

const key = (s: string) => s.trim().toLocaleLowerCase()
/** Sin id, un ítem es "el mismo" si coinciden lista, nombre, año y versión. */
const itemKey = (listId: Id, i: { name: string; year: number | null; version: string | null }) =>
  [listId, key(i.name), i.year ?? '', key(i.version ?? '')].join('\u0000')

/**
 * Merge sin borrar nada local:
 * - Listas: por id; si no, por nombre.
 * - Ítems: por id; si no, por nombre + año + versión dentro de la lista.
 * - Si matchea, gana el de `updatedAt` más nuevo. Sin fecha = nunca pisa.
 * - Un backup sin fotos nunca borra las fotos que ya tenés.
 */
export function planImport(incoming: ParsedList[], localLists: Collection[], localItems: Item[]): ImportPlan {
  const ts = nowIso()
  const summary = { listsAdded: 0, itemsAdded: 0, itemsUpdated: 0, unchanged: 0 }
  const outLists: Collection[] = []
  const outItems: ImportWrite[] = []

  const listsById = new Map(localLists.map((l) => [l.id, l]))
  const listsByName = new Map(localLists.map((l) => [key(l.name), l]))
  const itemsById = new Map(localItems.map((i) => [i.id, i]))
  // Por nombre+año+versión solo se empareja con lo que ya había, y cada ítem local una sola vez:
  // dos camisetas iguales del archivo (p. ej. dos talles) no se pisan entre sí.
  const itemsByKey = new Map<string, Item[]>()
  for (const i of localItems) {
    const k = itemKey(i.listId, i)
    itemsByKey.set(k, [...(itemsByKey.get(k) ?? []), i])
  }
  const claimed = new Set<Id>()
  const byKey = (k: string) => itemsByKey.get(k)?.find((i) => !claimed.has(i.id))
  let sortOrder = Math.max(-1, ...localLists.map((l) => l.sortOrder))

  for (const inList of incoming) {
    const { items, ...listData } = inList
    const match = (listData.id && listsById.get(listData.id)) || listsByName.get(key(listData.name))
    let listId: Id

    if (match) {
      listId = match.id
      const newer = listData.updatedAt > match.updatedAt
      const base = newer ? { ...match, name: listData.name, emoji: listData.emoji, fields: listData.fields, updatedAt: listData.updatedAt } : match
      // Los campos propios se suman siempre: si no, los valores de esos campos quedarían invisibles.
      const known = new Set(base.fields.custom.map((f) => f.id))
      const missing = listData.fields.custom.filter((f) => !known.has(f.id))
      if (newer || missing.length) {
        const merged = { ...base, fields: { ...base.fields, custom: [...base.fields.custom, ...missing] } }
        outLists.push(merged)
        listsById.set(listId, merged)
      }
    } else {
      listId = listData.id ?? newId()
      const created: Collection = {
        ...listData,
        id: listId,
        sortOrder: ++sortOrder,
        createdAt: listData.createdAt || ts,
        updatedAt: listData.updatedAt || ts,
      }
      outLists.push(created)
      listsById.set(listId, created)
      listsByName.set(key(created.name), created)
      summary.listsAdded++
    }

    for (const { thumb, photo, ...inItem } of items) {
      const found = (inItem.id && itemsById.get(inItem.id)) || byKey(itemKey(listId, inItem))
      if (found) {
        claimed.add(found.id)
        if (inItem.updatedAt > found.updatedAt) {
          const item: Item = { ...inItem, id: found.id, listId, thumb: thumb ?? found.thumb, createdAt: found.createdAt }
          outItems.push({ item, photo })
          summary.itemsUpdated++
        } else summary.unchanged++
        continue
      }
      const item: Item = {
        ...inItem,
        id: inItem.id ?? newId(),
        listId,
        thumb: thumb ?? null,
        createdAt: inItem.createdAt || ts,
        updatedAt: inItem.updatedAt || ts,
      }
      outItems.push({ item, photo })
      itemsById.set(item.id, item)
      claimed.add(item.id)
      summary.itemsAdded++
    }
  }

  return { lists: outLists, items: outItems, summary }
}
