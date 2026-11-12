/**
 * Cuándo dos ítems de una lista son "el mismo": mismo nombre, año y versión
 * (sin importar mayúsculas ni tildes). Así conviven "Boca Juniors 2007 Titular" y "Boca Juniors 2008 Alternativa",
 * pero no dos "Boca Juniors 2007 Titular". Lo usan el formulario (aviso), mover (agrega "(2)") y el import (pregunta).
 */
import type { Item } from './models'
import { fold } from './query'

type Identity = Pick<Item, 'name' | 'year' | 'version'>

const norm = (s: string | null) => fold((s ?? '').trim()).replace(/\s+/g, ' ')

export const identityKey = (i: Identity) => [norm(i.name), i.year ?? '', norm(i.version)].join('\u0000')

/** El otro ítem de la lista que sería "el mismo", si hay. */
export const findClash = (items: Item[], candidate: Identity & { listId: string }, exceptId?: string) =>
  items.find((i) => i.id !== exceptId && i.listId === candidate.listId && identityKey(i) === identityKey(candidate))

/** "Boca" → "Boca (2)" → "Boca (3)"… hasta que no choque. Un "(n)" que ya tenía se reemplaza, no se acumula. */
export function uniqueName(item: Identity, taken: Set<string>): string {
  if (!taken.has(identityKey(item))) return item.name
  const base = item.name.replace(/\s*\(\d+\)$/, '')
  for (let n = 2; ; n++) {
    const name = `${base} (${n})`
    if (!taken.has(identityKey({ ...item, name }))) return name
  }
}

/** "Boca Juniors 2007 Titular": para avisos y para el import. */
export const identityLabel = (i: Identity) => [i.name, i.year, i.version].filter((v) => v != null && v !== '').join(' ')
