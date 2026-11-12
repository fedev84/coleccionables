/** Qué cambia entre dos versiones de un ítem, para elegir con cuál quedarse al importar. */
import { STATUS_LABELS, type Item } from './models'
import { AUTHENTICITY_LABELS, BUILTIN_FIELDS, isShown, labelOf, type BuiltinField, type FieldConfig } from './fields'
import { formatNumber, formatPrice } from './numbers'
import { formatDay } from './dates'

export interface FieldDiff {
  label: string
  phone: string
  backup: string
}

const show = (v: unknown) => (v == null || v === '' ? '—' : String(v))

function builtinValue(i: Item, f: BuiltinField): unknown {
  if (f === 'authenticity') return i.authenticity && AUTHENTICITY_LABELS[i.authenticity]
  if (f === 'price') return i.price != null ? formatPrice(i.price) : null
  return i[f]
}

/** Solo los campos distintos, con el nombre que tienen en la lista. Los ocultos cuentan igual: el dato existe. */
export function diffItems(phone: Item, backup: Item, cfg: FieldConfig): FieldDiff[] {
  const rows: [string, unknown, unknown][] = [
    ['Nombre', phone.name, backup.name],
    ['Estado', STATUS_LABELS[phone.status], STATUS_LABELS[backup.status]],
    ['Tuve hasta', phone.goneAt && formatDay(phone.goneAt), backup.goneAt && formatDay(backup.goneAt)],
    ['Por qué ya no', phone.goneReason, backup.goneReason],
    ...BUILTIN_FIELDS.map((f): [string, unknown, unknown] => [
      labelOf(cfg, f) + (isShown(cfg, f) ? '' : ' (oculto)'), builtinValue(phone, f), builtinValue(backup, f),
    ]),
    ...cfg.custom.map((f): [string, unknown, unknown] => {
      const fmt = (v: unknown) => (typeof v === 'number' ? formatNumber(v) : v)
      return [f.label, fmt(phone.extra[f.id]), fmt(backup.extra[f.id])]
    }),
  ]
  return rows
    .map(([label, a, b]) => ({ label, phone: show(a), backup: show(b) }))
    .filter((r) => r.phone !== r.backup)
}
