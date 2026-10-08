import type { Item } from './models'
import { AUTHENTICITY_LABELS, defaultFields, isShown, type FieldConfig } from './fields'
import { formatNumber, formatPrice } from './numbers'

/**
 * La línea de info debajo del nombre: "2014 · Titular · L · 10 Riquelme · $ 25.000 · Manga larga".
 * Solo los campos visibles de la lista; la descripción siempre al final.
 */
export function itemLine(item: Item, cfg: FieldConfig = defaultFields()): string {
  const show = (f: Parameters<typeof isShown>[1], v: unknown) => (isShown(cfg, f) ? v : null)
  return [
    show('year', item.year),
    show('version', item.version),
    show('size', item.size),
    // Solo se marca la réplica: repetir "Original" en cada fila es ruido.
    show('authenticity', item.authenticity === 'replica' ? AUTHENTICITY_LABELS.replica : null),
    show('customization', item.customization),
    ...cfg.custom.map((f) => {
      const v = item.extra[f.id]
      return typeof v === 'number' ? formatNumber(v) : v
    }),
    show('price', item.price != null ? formatPrice(item.price) : null),
    show('place', item.place),
    show('description', item.description),
  ].filter((v) => v != null && v !== '').join(' · ')
}

export const hostOf = (url: string) => {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}
