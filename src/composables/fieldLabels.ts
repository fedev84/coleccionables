/** Nombres de los órdenes posibles, según los campos de la lista. */
import type { FieldConfig } from '@/domain/fields'
import { labelOf } from '@/domain/fields'
import type { SortDir, SortField } from '@/domain/query'
import { t } from '@/copy/es'

const customOf = (f: SortField, cfg: FieldConfig) => (f.startsWith('x:') ? cfg.custom.find((c) => c.id === f.slice(2)) : undefined)

export function sortName(f: SortField, cfg: FieldConfig): string {
  if (f === 'name' || f === 'createdAt' || f === 'updatedAt') return t.sortLabels[f]
  if (f === 'year' && !cfg.labels.year) return t.sortLabels.year
  const custom = customOf(f, cfg)
  if (custom) return custom.label
  return labelOf(cfg, f as Parameters<typeof labelOf>[1])
}

export function dirName(f: SortField, cfg: FieldConfig, dir: SortDir): string {
  const kind =
    f === 'createdAt' || f === 'updatedAt' ? 'date'
    : f === 'year' || f === 'size' || f === 'price' || f === 'authenticity' ? f
    : customOf(f, cfg)?.type === 'number' ? 'number'
    : 'text'
  return t.sortDir[kind][dir]
}
