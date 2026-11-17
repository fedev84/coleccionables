import type { Collection } from '@/domain/models'

/** Cuántos colores hay (ver .tint-N en variables.css). */
const TINTS = 6

/**
 * Color de cada lista según el orden en que se crearon: no cambia al reordenar ni al renombrar,
 * y listas creadas seguidas no repiten color (con un hash del id, 3 de 7 salían iguales).
 */
export function tintsOf(lists: Pick<Collection, 'id' | 'createdAt'>[]): Record<string, string> {
  const byAge = [...lists].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
  return Object.fromEntries(byAge.map((l, n) => [l.id, `tint-${n % TINTS}`]))
}
