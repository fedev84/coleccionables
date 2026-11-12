import type { CustomField } from './fields'
import type { Authenticity, ItemInput, ItemStatus, NewCollectionInput } from './models'
import { parseNumber } from './numbers'
import { isEmoji } from './suggestions'

export class ValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message)
  }
}

export const clean = (v: string | null | undefined) => {
  const t = v?.trim()
  return t ? t : null
}

/** Acepta "sitio.com/x" y lo normaliza a https. */
export function normalizeUrl(raw: string | null | undefined): string | null {
  const v = clean(raw)
  if (!v) return null
  const invalid = new ValidationError('url', 'Ese link no parece válido')
  // new URL() acepta "con parche" como host: los espacios y los hosts sin punto se rechazan acá.
  if (/\s/.test(v)) throw invalid
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`
  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    throw invalid
  }
  if (!url.hostname.includes('.')) throw invalid
  return url.toString()
}

export const MIN_YEAR = 1850
export const maxYear = () => new Date().getFullYear() + 2

export function parseYear(raw: string | number | null | undefined): number | null {
  const v = clean(raw == null ? null : String(raw))
  if (!v) return null
  const n = Number(v)
  if (!Number.isInteger(n) || n < MIN_YEAR || n > maxYear()) {
    throw new ValidationError('year', `Poné un año entre ${MIN_YEAR} y ${maxYear()}`)
  }
  return n
}

export function parsePrice(raw: string | number | null | undefined): number | null {
  const n = parseNumber(raw)
  if (Number.isNaN(n) || (n !== null && n < 0)) throw new ValidationError('price', 'Poné un precio válido (ej: 25.000)')
  return n
}

/** "Réplica", "replica" o "REPLICA" valen igual; cualquier otra cosa es "sin dato". */
export function parseAuthenticity(raw: unknown): Authenticity | null {
  if (typeof raw !== 'string') return null
  const v = raw.trim().toLowerCase().replace('é', 'e')
  return v === 'original' || v === 'replica' ? v : null
}

export const parseStatus = (raw: unknown): ItemStatus => (raw === 'want' || raw === 'gone' ? raw : 'have')

/** Hoy en AAAA-MM-DD, en la hora local (no UTC: a la noche sería mañana). */
export function today(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}

/** Una fecha AAAA-MM-DD que exista; si no, null. */
export function parseDay(raw: unknown): string | null {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.trim())) return null
  const v = raw.trim()
  const d = new Date(`${v}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : null
}

export interface CleanItem {
  name: string
  status: ItemStatus
  year: number | null
  version: string | null
  size: string | null
  authenticity: Authenticity | null
  customization: string | null
  url: string | null
  description: string | null
  price: number | null
  place: string | null
  extra: Record<string, string | number>
  goneAt: string | null
  goneReason: string | null
}

/** Solo se guardan los campos propios que la lista tiene; los vacíos no se guardan. */
export function cleanExtra(raw: Record<string, string | number> | undefined, custom: CustomField[]) {
  const out: Record<string, string | number> = {}
  for (const f of custom) {
    const v = raw?.[f.id]
    if (f.type === 'number') {
      const n = parseNumber(v)
      if (Number.isNaN(n)) throw new ValidationError(`x:${f.id}`, 'Tiene que ser un número')
      if (n !== null) out[f.id] = n
    } else {
      const s = clean(v == null ? null : String(v))
      if (s) out[f.id] = s
    }
  }
  return out
}

export function validateItem(input: ItemInput, custom: CustomField[] = []): CleanItem {
  const name = clean(input.name)
  if (!name) throw new ValidationError('name', 'Ponele un nombre')
  const status = parseStatus(input.status)
  const gone = status === 'gone'
  return {
    name,
    status,
    // Fuera de "Tuve" no se guardan: si la recuperás, vuelve a ser una pieza más.
    goneAt: gone ? (parseDay(input.goneAt) ?? today()) : null,
    goneReason: gone ? clean(input.goneReason) : null,
    year: parseYear(input.year),
    version: clean(input.version),
    size: clean(input.size),
    authenticity: parseAuthenticity(input.authenticity),
    customization: clean(input.customization),
    url: normalizeUrl(input.url),
    description: clean(input.description),
    price: parsePrice(input.price),
    place: clean(input.place),
    extra: cleanExtra(input.extra, custom),
  }
}

export function validateCollection<T extends Partial<NewCollectionInput>>(input: T): T {
  const out = { ...input }
  if ('name' in input) {
    const name = clean(input.name)
    if (!name) throw new ValidationError('name', 'La lista necesita un nombre')
    out.name = name
  }
  if ('emoji' in input) {
    if (!isEmoji(input.emoji ?? '')) throw new ValidationError('emoji', 'Elegí un solo emoji')
    out.emoji = input.emoji!.trim()
  }
  return out
}
