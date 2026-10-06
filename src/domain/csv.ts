/** Planilla para abrir en Excel / Google Sheets. Solo export: el import es con el JSON. */
import type { Collection, Item } from './models'
import { groupByList, sortLists } from './backup'
import { formatNumber } from './numbers'

/** Punto y coma: el Excel en español usa la coma para decimales y no separa columnas con coma. */
const SEP = ';'
/** Columnas fijas (las listas pueden tener otros nombres): los campos propios van juntos en "Otros". */
const HEADERS = ['Lista', 'Nombre', 'Estado', 'Año', 'Versión', 'Tamaño', 'Precio', 'Dónde', 'Link', 'Descripción', 'Otros', 'Cargado', 'Editado']

const cell = (v: string | number | null) => {
  const s = v == null ? '' : String(v)
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

const day = (iso: string) => iso.slice(0, 10)

export function buildCsv(lists: Collection[], items: Item[]): string {
  const byList = groupByList(items)
  const rows = sortLists(lists).flatMap((l) =>
    (byList.get(l.id) ?? []).map((i) => [
      l.name, i.name, i.status === 'want' ? 'Me falta' : 'Tengo', i.year, i.version, i.size,
      // El precio con coma decimal, como lo lee el Excel en español.
      i.price != null ? String(i.price).replace('.', ',') : null, i.place, i.url, i.description,
      l.fields.custom
        .filter((f) => i.extra[f.id] != null)
        .map((f) => `${f.label}: ${typeof i.extra[f.id] === 'number' ? formatNumber(i.extra[f.id] as number) : i.extra[f.id]}`)
        .join(' | ') || null,
      day(i.createdAt), day(i.updatedAt),
    ]))
  // BOM: sin él, Excel lee mal las tildes.
  return '﻿' + [HEADERS, ...rows].map((r) => r.map(cell).join(SEP)).join('\r\n') + '\r\n'
}
