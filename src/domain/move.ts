/**
 * Mover ítems a otra lista. Puro: devuelve qué guardar.
 * Los campos propios con datos viajan con el ítem: si la lista destino tiene uno con el mismo nombre y tipo,
 * el valor pasa a ese; si no, el campo se suma a la lista destino (si no, el dato quedaría invisible).
 */
import type { Collection, Item, Timestamp } from './models'
import type { CustomField, FieldConfig } from './fields'

export interface MovePlan {
  items: Item[]
  /** La configuración nueva de la lista destino, o null si no cambia. */
  fields: FieldConfig | null
}

const sameField = (a: CustomField, b: CustomField) => a.type === b.type && a.label.trim().toLowerCase() === b.label.trim().toLowerCase()

export function planMove(items: Item[], from: Collection, to: Collection, ts: Timestamp): MovePlan {
  const moving = items.filter((i) => i.listId === from.id && from.id !== to.id)
  const used = from.fields.custom.filter((f) => moving.some((i) => i.extra[f.id] != null))
  const added: CustomField[] = []
  /** id en la lista de origen → id en la lista destino. */
  const target = new Map<string, string>()
  for (const f of used) {
    const match = to.fields.custom.find((g) => g.id === f.id) ?? to.fields.custom.find((g) => sameField(f, g))
    if (match) target.set(f.id, match.id)
    else {
      added.push(f)
      target.set(f.id, f.id)
    }
  }
  return {
    items: moving.map((i) => ({
      ...i,
      listId: to.id,
      extra: Object.fromEntries(Object.entries(i.extra).map(([k, v]) => [target.get(k) ?? k, v])),
      updatedAt: ts,
    })),
    fields: added.length ? { ...to.fields, custom: [...to.fields.custom, ...added] } : null,
  }
}
