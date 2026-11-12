import { describe, expect, it } from 'vitest'
import type { Collection, Item } from './models'
import { defaultFields } from './fields'
import { parseDay, today, validateItem } from './validation'
import { DEFAULT_VIEW, applyView, parseView } from './query'
import { identityKey, uniqueName } from './identity'
import { planMove } from './move'

let n = 0
const item = (p: Partial<Item>): Item => ({
  id: String(++n), listId: 'a', name: 'x', status: 'have', year: null, version: null, size: null,
  url: null, description: null, price: null, place: null, authenticity: null, customization: null, extra: {},
  goneAt: null, goneReason: null, thumb: null, createdAt: '', updatedAt: '', ...p,
})
const list = (id: string): Collection => ({ id, name: id, emoji: '👕', fields: defaultFields(), sortOrder: 0, createdAt: '', updatedAt: '' })
const base = { name: 'Boca', status: 'gone' as const, year: null, version: null, size: null, url: null, description: null }

describe('Tuve', () => {
  it('guarda fecha (hoy si no viene o es inválida) y motivo; fuera de "Tuve" los borra', () => {
    expect(validateItem({ ...base, goneAt: '2025-03-12', goneReason: ' Regalada ' })).toMatchObject({ status: 'gone', goneAt: '2025-03-12', goneReason: 'Regalada' })
    expect(validateItem({ ...base, goneAt: '2025-02-30' }).goneAt).toBe(today())
    expect(validateItem({ ...base, status: 'have', goneAt: '2025-03-12', goneReason: 'x' })).toMatchObject({ goneAt: null, goneReason: null })
  })

  it('valida fechas de verdad', () => {
    expect(parseDay('2024-02-29')).toBe('2024-02-29')
    expect(parseDay('2025-02-29')).toBeNull()
    expect(parseDay('12/03/2025')).toBeNull()
    expect(today(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05')
  })

  it('"Todos" es tengo + me falta; "Tuve" va aparte y la búsqueda global ve todo', () => {
    const xs = [item({ name: 'A' }), item({ name: 'B', status: 'want' }), item({ name: 'C', status: 'gone', goneReason: 'Regalada' })]
    const names = (s: Parameters<typeof applyView>[1]['status'], text = '') => applyView(xs, { ...DEFAULT_VIEW, status: s }, text).map((i) => i.name)
    expect(names('all')).toEqual(['A', 'B'])
    expect(names('gone')).toEqual(['C'])
    expect(names('any', 'regalada')).toEqual(['C'])
    expect(parseView('{"status":"gone"}').status).toBe('gone')
  })
})

describe('nombre + año + versión', () => {
  it('mismo nombre con otro año o versión no choca; sin importar mayúsculas ni tildes, sí', () => {
    const k = identityKey({ name: 'Boca Juniors', year: 2007, version: 'Titular' })
    expect(identityKey({ name: ' boca  juniors ', year: 2007, version: 'titular' })).toBe(k)
    expect(identityKey({ name: 'Boca Juniors', year: 2008, version: 'Titular' })).not.toBe(k)
  })

  it('agrega (2), (3)… y reemplaza un número que ya tenía', () => {
    const taken = new Set(['Boca', 'Boca (2)'].map((name) => identityKey({ name, year: 2007, version: null })))
    expect(uniqueName({ name: 'Boca', year: 2007, version: null }, taken)).toBe('Boca (3)')
    expect(uniqueName({ name: 'Boca (2)', year: 2007, version: null }, taken)).toBe('Boca (3)')
    expect(uniqueName({ name: 'Boca', year: 2008, version: null }, taken)).toBe('Boca')
  })

  it('al mover, si en la lista destino ya está, entra como "… (2)"', () => {
    const moving = [item({ name: 'Boca', year: 2007 }), item({ name: 'River', year: 1986 })]
    const plan = planMove(moving, list('a'), list('b'), 'T', [item({ listId: 'b', name: 'boca', year: 2007 })])
    expect(plan.items.map((i) => i.name)).toEqual(['Boca (2)', 'River'])
    expect(plan.renamed).toBe(1)
  })
})
