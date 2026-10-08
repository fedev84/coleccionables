import { describe, expect, it } from 'vitest'
import type { Item } from './models'
import { itemLine } from './itemLine'
import { suggest } from './suggestions'
import { ValidationError, normalizeUrl, parseYear, validateItem } from './validation'

const base = { name: 'Boca 2014', status: 'have' as const, year: '', version: '', size: '', url: '', description: '' }

describe('validateItem', () => {
  it('limpia espacios y deja null lo vacío', () => {
    expect(validateItem({ ...base, name: '  Boca  ', version: ' Titular ' })).toEqual({
      name: 'Boca', status: 'have', year: null, version: 'Titular', size: null, url: null, description: null,
      price: null, place: null, authenticity: null, customization: null, extra: {},
    })
  })

  it('exige nombre', () => {
    expect(() => validateItem({ ...base, name: '  ' })).toThrow(ValidationError)
  })

  it('convierte el año y rechaza años raros', () => {
    expect(validateItem({ ...base, year: '1998' }).year).toBe(1998)
    expect(() => parseYear('98')).toThrow(ValidationError)
    expect(() => parseYear('2014.5')).toThrow(ValidationError)
    expect(() => parseYear('abc')).toThrow(ValidationError)
  })
})

describe('normalizeUrl', () => {
  it('agrega https', () => {
    expect(normalizeUrl('tienda.com/boca')).toBe('https://tienda.com/boca')
    expect(normalizeUrl('http://x.com')).toBe('http://x.com/')
  })
  it('rechaza basura', () => {
    expect(() => normalizeUrl('no es un link')).toThrow(ValidationError)
    expect(() => normalizeUrl('Con parche de la Libertadores')).toThrow(ValidationError)
    expect(() => normalizeUrl('boca')).toThrow(ValidationError)
  })
})

describe('itemLine', () => {
  const blank: Item = {
    id: '1', listId: 'l', name: 'x', status: 'have', year: null, version: null, size: null, url: null, description: null,
    price: null, place: null, authenticity: null, customization: null, extra: {}, thumb: null, createdAt: '', updatedAt: '',
  }
  it('une solo lo que hay', () => {
    expect(itemLine({ ...blank, year: 2014, version: 'Titular', description: 'Con parche' })).toBe('2014 · Titular · Con parche')
    expect(itemLine(blank)).toBe('')
  })
})

describe('suggest', () => {
  it('primero lo usado, sin repetir, filtrando lo tipeado', () => {
    expect(suggest(['Retro', 'Tercera'], ['Titular', 'Retro'], '')).toEqual(['Retro', 'Tercera', 'Titular'])
    expect(suggest(['Tercera'], ['Titular'], 'ter')).toEqual(['Tercera'])
    expect(suggest([], ['Titular'], 'titular')).toEqual([])
  })
})
