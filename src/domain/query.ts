/** Buscar, filtrar y ordenar ítems en memoria. Puro: se testea solo. */
import type { Item, ItemStatus } from './models'
import { BUILTIN_FIELDS, defaultFields, isShown, type BuiltinField, type FieldConfig } from './fields'

export type StatusFilter = 'all' | ItemStatus
type BaseSortField = 'name' | 'createdAt' | 'updatedAt'
/** Los campos propios se ordenan como `x:<id>`. */
export type SortField = BaseSortField | Exclude<BuiltinField, 'url' | 'description'> | `x:${string}`
export type SortDir = 'asc' | 'desc'

export interface ListView {
  status: StatusFilter
  sort: SortField
  dir: SortDir
}

export const DEFAULT_VIEW: ListView = { status: 'all', sort: 'name', dir: 'asc' }

const SORTABLE_BUILTINS = BUILTIN_FIELDS.filter((f) => f !== 'url' && f !== 'description') as Exclude<BuiltinField, 'url' | 'description'>[]

/** Por qué se puede ordenar en una lista: nombre, sus campos visibles, sus campos propios y las fechas. */
export function sortFields(cfg: FieldConfig): SortField[] {
  return [
    'name',
    ...SORTABLE_BUILTINS.filter((f) => isShown(cfg, f)),
    ...cfg.custom.map((f) => `x:${f.id}` as const),
    'createdAt',
    'updatedAt',
  ]
}

/** Si el orden guardado ya no existe (campo oculto o borrado), se ordena por nombre. */
export const resolveView = (view: ListView, cfg: FieldConfig): ListView =>
  sortFields(cfg).includes(view.sort) ? view : { ...view, sort: 'name', dir: 'asc' }

/** Al elegir un orden nuevo: fechas, de lo más nuevo a lo más viejo; el resto, de menor a mayor. */
export const defaultDir = (f: SortField): SortDir => (f === 'createdAt' || f === 'updatedAt' ? 'desc' : 'asc')

/** Sin tildes ni mayúsculas: "Atlético" encuentra "atletico". */
export const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

const haystack = (i: Item) =>
  fold([i.name, i.description, i.version, i.size, i.year, i.place, i.price, ...Object.values(i.extra)].filter((v) => v != null).join(' '))

/** Cada palabra buscada tiene que aparecer en algún campo, en cualquier orden. */
export function matches(item: Item, text: string): boolean {
  const words = fold(text).split(/\s+/).filter(Boolean)
  if (!words.length) return true
  const h = haystack(item)
  return words.every((w) => h.includes(w))
}

/** Talles en su orden natural; lo que no está en la lista va después, alfabético. */
const SIZE_ORDER = ['xxs', 'xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl']
const sizeRank = (s: string) => {
  const i = SIZE_ORDER.indexOf(s.trim().toLowerCase())
  return i === -1 ? SIZE_ORDER.length : i
}

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true })

const valueOf = (i: Item, f: SortField): unknown => (f.startsWith('x:') ? i.extra[f.slice(2)] : i[f as keyof Item])

function compareValues(a: unknown, b: unknown, f: SortField): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (f === 'size') return sizeRank(String(a)) - sizeRank(String(b)) || collator.compare(String(a), String(b))
  return collator.compare(String(a), String(b))
}

const isEmpty = (v: unknown) => v == null || v === ''

export function applyView(items: Item[], view: ListView, text = '', cfg: FieldConfig = defaultFields()): Item[] {
  const { status, sort, dir } = resolveView(view, cfg)
  const sign = dir === 'asc' ? 1 : -1
  return items
    .filter((i) => (status === 'all' || i.status === status) && matches(i, text))
    .sort((a, b) => {
      const va = valueOf(a, sort)
      const vb = valueOf(b, sort)
      // Los que no tienen el dato van siempre al final, en cualquier sentido.
      const ea = isEmpty(va)
      const eb = isEmpty(vb)
      if (ea !== eb) return ea ? 1 : -1
      const c = ea ? 0 : compareValues(va, vb, sort) * sign
      return c || collator.compare(a.name, b.name)
    })
}

const KNOWN: string[] = ['name', 'createdAt', 'updatedAt', ...SORTABLE_BUILTINS]

/** Lee lo guardado sin confiar en el formato (puede venir de una versión vieja). */
export function parseView(raw: string | null): ListView {
  try {
    const v = JSON.parse(raw ?? '{}') as Partial<ListView>
    const sort = typeof v.sort === 'string' && (KNOWN.includes(v.sort) || v.sort.startsWith('x:')) ? v.sort : DEFAULT_VIEW.sort
    return {
      status: v.status === 'have' || v.status === 'want' ? v.status : 'all',
      sort,
      dir: v.dir === 'desc' ? 'desc' : 'asc',
    }
  } catch {
    return { ...DEFAULT_VIEW }
  }
}
