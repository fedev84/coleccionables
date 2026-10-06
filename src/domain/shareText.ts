/**
 * Lo que se comparte por WhatsApp: "lo que me falta" (o "lo que tengo"), como texto o como imagen.
 * Sin precio, lugar ni descripción: es para mostrarle a otro qué buscás.
 */
import type { Collection, Item, ItemStatus } from './models'
import { isShown } from './fields'

export function shareTitle(list: Collection, n: number, status: ItemStatus): string {
  return status === 'want'
    ? `${list.emoji} ${list.name}: ${n === 1 ? 'me falta 1' : `me faltan ${n}`}`
    : `${list.emoji} ${list.name}: tengo ${n}`
}

/** "2009 · Alternativa · L": solo año, versión y tamaño, si la lista los muestra. */
export function shareInfo(list: Collection, item: Item): string {
  return (['year', 'version', 'size'] as const)
    .filter((f) => isShown(list.fields, f))
    .map((f) => item[f])
    .filter((v) => v != null && v !== '')
    .join(' · ')
}

export function shareText(list: Collection, items: Item[], status: ItemStatus): string {
  const chosen = items.filter((i) => i.status === status)
  const lines = chosen.map((i) => {
    const info = shareInfo(list, i)
    return `• ${i.name}${info ? ` (${info})` : ''}`
  })
  return [shareTitle(list, chosen.length, status), '', ...lines].join('\n')
}

/** Una imagen muy larga WhatsApp la comprime ilegible: se parte en varias de este tamaño. */
export const IMAGE_PAGE_SIZE = 40

export function pages<T>(items: T[], size = IMAGE_PAGE_SIZE): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}
