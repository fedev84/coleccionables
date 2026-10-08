import { describe, expect, it } from 'vitest'
import type { Collection, Item } from './models'
import { defaultFields, labelOf, moveCustom, parseFields, type FieldConfig } from './fields'
import { itemLine } from './itemLine'
import { parseNumber } from './numbers'
import { pages, shareText } from './shareText'
import { ValidationError, cleanExtra, parsePrice } from './validation'

const item = (p: Partial<Item>): Item => ({
  id: '1', listId: 'l', name: 'x', status: 'have', year: null, version: null, size: null, url: null, description: null,
  price: null, place: null, authenticity: null, customization: null, extra: {}, thumb: null, createdAt: '', updatedAt: '', ...p,
})

describe('parseNumber', () => {
  it('entiende el formato argentino', () => {
    expect(parseNumber('25.000')).toBe(25000)
    expect(parseNumber('$ 1.234,50')).toBe(1234.5)
    expect(parseNumber('3500')).toBe(3500)
    expect(parseNumber('12.5')).toBe(12.5)
    expect(parseNumber('')).toBeNull()
    expect(parseNumber('caro')).toBeNaN()
  })
  it('rechaza precios inválidos', () => {
    expect(() => parsePrice('caro')).toThrow(ValidationError)
    expect(() => parsePrice('-5')).toThrow(ValidationError)
  })
})

describe('parseFields', () => {
  it('tolera basura y descarta lo desconocido', () => {
    expect(parseFields(null)).toEqual(defaultFields())
    expect(parseFields('{roto')).toEqual(defaultFields())
    expect(parseFields({ hidden: ['size', 'nada'], labels: { version: ' Edición ', foo: 'x' }, custom: [{ id: 'a', label: 'Sello', type: 'raro' }, { id: 'a', label: 'dup' }, { label: 'sin id' }] }))
      .toEqual({ hidden: ['size'], labels: { version: 'Edición' }, custom: [{ id: 'a', label: 'Sello', type: 'text' }] })
  })
  it('usa la etiqueta propia o la de fábrica', () => {
    const cfg = parseFields({ labels: { version: 'Edición' } })
    expect(labelOf(cfg, 'version')).toBe('Edición')
    expect(labelOf(cfg, 'size')).toBe('Tamaño')
  })
})

describe('cleanExtra', () => {
  const custom = [{ id: 'd', label: 'Dorsal', type: 'number' as const }, { id: 's', label: 'Sello', type: 'text' as const }]
  it('guarda solo los campos de la lista, sin vacíos, con números de verdad', () => {
    expect(cleanExtra({ d: '10', s: ' Sony ', otro: 'x' }, custom)).toEqual({ d: 10, s: 'Sony' })
    expect(cleanExtra({ d: '', s: '' }, custom)).toEqual({})
    expect(() => cleanExtra({ d: 'diez' }, custom)).toThrow(ValidationError)
  })
})

describe('itemLine con campos de la lista', () => {
  it('muestra la personalización, salvo que esté oculta', () => {
    const i = item({ year: 2001, size: 'L', customization: '10 Riquelme · Firmada' })
    expect(itemLine(i)).toBe('2001 · L · 10 Riquelme · Firmada')
    expect(itemLine(i, { ...defaultFields(), hidden: ['customization'] })).toBe('2001 · L')
  })

  it('marca solo las réplicas, y no si el campo está oculto', () => {
    expect(itemLine(item({ year: 2014, authenticity: 'replica' }))).toBe('2014 · Réplica')
    expect(itemLine(item({ year: 2014, authenticity: 'original' }))).toBe('2014')
    expect(itemLine(item({ authenticity: 'replica' }), { ...defaultFields(), hidden: ['authenticity'] })).toBe('')
  })

  it('oculta lo oculto, suma campos propios y precio', () => {
    const cfg: FieldConfig = { hidden: ['size'], labels: {}, custom: [{ id: 'd', label: 'Dorsal', type: 'number' }] }
    const i = item({ year: 2014, size: 'L', price: 25000, place: 'Feria', extra: { d: 10 }, description: 'Firmada' })
    expect(itemLine(i, cfg)).toBe('2014 · 10 · $ 25.000 · Feria · Firmada')
  })
})

describe('shareText', () => {
  const list: Collection = { id: 'l', name: 'Camisetas', emoji: '👕', fields: defaultFields(), sortOrder: 0, createdAt: '', updatedAt: '' }
  it('arma el mensaje de lo que falta sin precio ni lugar', () => {
    const items = [
      item({ name: 'Barcelona', status: 'want', year: 2009, version: 'Alternativa', customization: '10 Messi', price: 9, place: 'X' }),
      item({ name: 'Boca', status: 'have' }),
      item({ name: 'River', status: 'want' }),
    ]
    expect(shareText(list, items, 'want')).toBe('👕 Camisetas: me faltan 2\n\n• Barcelona (2009 · Alternativa · 10 Messi)\n• River')
  })
})

describe('moveCustom', () => {
  const f = (id: string) => ({ id, label: id, type: 'text' as const })
  it('mueve hacia abajo y hacia arriba sin perder nada', () => {
    expect(moveCustom([f('a'), f('b'), f('c')], 0, 2).map((c) => c.id)).toEqual(['b', 'c', 'a'])
    expect(moveCustom([f('a'), f('b'), f('c')], 2, 0).map((c) => c.id)).toEqual(['c', 'a', 'b'])
    expect(moveCustom([f('a'), f('b')], 5, 0).map((c) => c.id)).toEqual(['a', 'b'])
  })
})

describe('pages', () => {
  it('parte en tandas sin perder ítems', () => {
    expect(pages([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(pages([], 2)).toEqual([])
  })
})
