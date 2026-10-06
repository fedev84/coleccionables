/**
 * Campos de cada lista. Todas tienen nombre y estado; el resto se puede ocultar o renombrar,
 * y se pueden sumar campos propios (texto o número). Renombrar es solo la etiqueta:
 * "Año" sigue validándose como año aunque se llame "Temporada".
 */
import { newId } from './ids'

export type BuiltinField = 'year' | 'version' | 'size' | 'price' | 'place' | 'url' | 'description'
/** En este orden se muestran en el formulario y en la línea de info. */
export const BUILTIN_FIELDS: BuiltinField[] = ['year', 'version', 'size', 'price', 'place', 'url', 'description']

export const DEFAULT_LABELS: Record<BuiltinField, string> = {
  year: 'Año de salida',
  version: 'Versión',
  size: 'Tamaño',
  price: 'Precio pagado',
  place: 'Dónde lo compré',
  url: 'Link',
  description: 'Descripción corta',
}

export type CustomFieldType = 'text' | 'number'

export interface CustomField {
  id: string
  label: string
  type: CustomFieldType
}

export interface FieldConfig {
  hidden: BuiltinField[]
  labels: Partial<Record<BuiltinField, string>>
  custom: CustomField[]
}

export const defaultFields = (): FieldConfig => ({ hidden: [], labels: {}, custom: [] })

export const isShown = (cfg: FieldConfig, f: BuiltinField) => !cfg.hidden.includes(f)
export const labelOf = (cfg: FieldConfig, f: BuiltinField) => cfg.labels[f]?.trim() || DEFAULT_LABELS[f]
/** ¿La etiqueta es la de fábrica? Las sugerencias de camisetas (Titular, XL…) solo tienen sentido ahí. */
export const isDefaultLabel = (cfg: FieldConfig, f: BuiltinField) => !cfg.labels[f]?.trim()

export const newCustomField = (label: string, type: CustomFieldType): CustomField => ({ id: newId().slice(0, 8), label: label.trim(), type })

const isBuiltin = (v: unknown): v is BuiltinField => BUILTIN_FIELDS.includes(v as BuiltinField)

/** Lee la configuración sin confiar en el formato (base, backup escrito a mano, versión vieja). */
export function parseFields(raw: unknown): FieldConfig {
  let v: unknown = raw
  if (typeof raw === 'string') {
    try { v = JSON.parse(raw) } catch { v = null }
  }
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  const labels: FieldConfig['labels'] = {}
  if (o.labels && typeof o.labels === 'object') {
    for (const [k, l] of Object.entries(o.labels as Record<string, unknown>)) {
      if (isBuiltin(k) && typeof l === 'string' && l.trim()) labels[k] = l.trim()
    }
  }
  const seen = new Set<string>()
  const custom = (Array.isArray(o.custom) ? o.custom : []).flatMap((c): CustomField[] => {
    const f = (c ?? {}) as Record<string, unknown>
    if (typeof f.id !== 'string' || !f.id || seen.has(f.id) || typeof f.label !== 'string' || !f.label.trim()) return []
    seen.add(f.id)
    return [{ id: f.id, label: f.label.trim(), type: f.type === 'number' ? 'number' : 'text' }]
  })
  return { hidden: (Array.isArray(o.hidden) ? o.hidden : []).filter(isBuiltin), labels, custom }
}

export const isDefaultConfig = (cfg: FieldConfig) => !cfg.hidden.length && !Object.keys(cfg.labels).length && !cfg.custom.length

/** Mueve un campo propio de lugar: define el orden en el formulario, la línea de info y el menú de orden. */
export function moveCustom(custom: CustomField[], from: number, to: number): CustomField[] {
  const out = [...custom]
  const [moved] = out.splice(from, 1)
  if (moved) out.splice(Math.max(0, Math.min(to, out.length)), 0, moved)
  return out
}
