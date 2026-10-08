import { describe, expect, it } from 'vitest'
import type { Item } from './models'
import { defaultFields, type FieldConfig } from './fields'
import { DEFAULT_VIEW, applyView, matches, parseView, resolveView, sortFields } from './query'

let n = 0
const item = (p: Partial<Item>): Item => ({
  id: String(++n), listId: 'l', name: 'x', status: 'have', year: null, version: null, size: null,
  url: null, description: null, price: null, place: null, authenticity: null, customization: null, extra: {}, thumb: null,
  createdAt: '2026-01-01', updatedAt: '2026-01-01', ...p,
})

const boca = item({ name: 'Boca Juniors', year: 2014, version: 'Titular', size: 'L', description: 'Con parche' })
const river = item({ name: 'River Plate', year: 1986, version: 'Retro', size: 'M', status: 'want' })
const atl = item({ name: 'Atlético Madrid', size: 'XL', createdAt: '2026-05-01' })
const all = [boca, river, atl]
const names = (xs: Item[]) => xs.map((i) => i.name)

describe('matches', () => {
  it('ignora tildes, mayúsculas y orden de palabras', () => {
    expect(matches(atl, 'atletico')).toBe(true)
    expect(matches(boca, 'titular 2014')).toBe(true)
    expect(matches(boca, '2014 PARCHE')).toBe(true)
    expect(matches(boca, 'suplente')).toBe(false)
  })
})

describe('applyView', () => {
  it('filtra por estado y texto', () => {
    expect(names(applyView(all, { ...DEFAULT_VIEW, status: 'want' }))).toEqual(['River Plate'])
    expect(names(applyView(all, DEFAULT_VIEW, 'juniors'))).toEqual(['Boca Juniors'])
  })

  it('ordena por año y deja los vacíos al final en ambos sentidos', () => {
    expect(names(applyView(all, { ...DEFAULT_VIEW, sort: 'year', dir: 'asc' }))).toEqual(['River Plate', 'Boca Juniors', 'Atlético Madrid'])
    expect(names(applyView(all, { ...DEFAULT_VIEW, sort: 'year', dir: 'desc' }))).toEqual(['Boca Juniors', 'River Plate', 'Atlético Madrid'])
  })

  it('ordena talles en su orden natural', () => {
    expect(names(applyView(all, { ...DEFAULT_VIEW, sort: 'size' }))).toEqual(['River Plate', 'Boca Juniors', 'Atlético Madrid'])
  })

  it('no modifica el array original', () => {
    const copy = [...all]
    applyView(all, { ...DEFAULT_VIEW, dir: 'desc' })
    expect(all).toEqual(copy)
  })
})

describe('parseView', () => {
  it('tolera basura y valores viejos', () => {
    expect(parseView(null)).toEqual(DEFAULT_VIEW)
    expect(parseView('{roto')).toEqual(DEFAULT_VIEW)
    expect(parseView('{"status":"want","sort":"precio","dir":"desc"}')).toEqual({ status: 'want', sort: 'name', dir: 'desc' })
  })
})

describe('campos nuevos y propios', () => {
  const cfg: FieldConfig = { ...defaultFields(), hidden: ['size'], custom: [{ id: 'd', label: 'Dorsal', type: 'number' }] }
  const a = item({ name: 'A', price: 30000, place: 'Feria de San Telmo', extra: { d: 10 } })
  const b = item({ name: 'B', price: 5000, extra: { d: 9 } })
  const c = item({ name: 'C' })

  it('busca en lugar y campos propios', () => {
    expect(matches(a, 'san telmo')).toBe(true)
    expect(matches(a, '10')).toBe(true)
  })

  it('ordena por precio y por campo propio numérico', () => {
    expect(names(applyView([a, b, c], { ...DEFAULT_VIEW, sort: 'price' }))).toEqual(['B', 'A', 'C'])
    expect(names(applyView([a, b, c], { ...DEFAULT_VIEW, sort: 'x:d' }, '', cfg))).toEqual(['B', 'A', 'C'])
  })

  it('ofrece ordenar solo por lo visible, y si el campo ya no está, por nombre', () => {
    expect(sortFields(cfg)).toEqual(['name', 'year', 'version', 'authenticity', 'price', 'place', 'x:d', 'createdAt', 'updatedAt'])
    expect(resolveView({ ...DEFAULT_VIEW, sort: 'size', dir: 'desc' }, cfg)).toEqual({ ...DEFAULT_VIEW, sort: 'name', dir: 'asc' })
    expect(parseView('{"sort":"x:d"}').sort).toBe('x:d')
  })
})
