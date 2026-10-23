import { describe, expect, it } from 'vitest'
import type { Collection, Item } from './models'
import { defaultFields, type CustomField } from './fields'
import { planMove } from './move'
import { isEmoji } from './suggestions'
import { ValidationError, validateCollection } from './validation'

const list = (id: string, custom: CustomField[] = []): Collection => ({
  id, name: id, emoji: '👕', fields: { ...defaultFields(), custom }, sortOrder: 0, createdAt: '', updatedAt: '',
})
const item = (p: Partial<Item>): Item => ({
  id: '1', listId: 'A', name: 'x', status: 'have', year: null, version: null, size: null, authenticity: null, customization: null,
  url: null, description: null, price: null, place: null, extra: {}, thumb: 'data:image/jpeg;base64,T', createdAt: '', updatedAt: '', ...p,
})
const jugador: CustomField = { id: 'j1', label: 'Jugador', type: 'text' }

describe('planMove', () => {
  it('cambia la lista y la fecha, y conserva todo lo demás (foto incluida)', () => {
    const boca = item({ id: 'b', year: 2001, customization: 'Dorsal 10' })
    const { items, fields } = planMove([boca], list('A'), list('B'), 'T')
    expect(items).toEqual([{ ...boca, listId: 'B', updatedAt: 'T' }])
    expect(fields).toBeNull()
  })

  it('suma a la lista destino los campos propios que traen datos, y no los vacíos', () => {
    const sello: CustomField = { id: 's1', label: 'Sello', type: 'text' }
    const { items, fields } = planMove([item({ extra: { j1: 'Riquelme' } })], list('A', [jugador, sello]), list('B'), 'T')
    expect(fields?.custom).toEqual([jugador])
    expect(items[0].extra).toEqual({ j1: 'Riquelme' })
  })

  it('si el destino ya tiene un campo con el mismo nombre y tipo, el dato pasa a ese', () => {
    const otro: CustomField = { id: 'j2', label: 'jugador ', type: 'text' }
    const { items, fields } = planMove([item({ extra: { j1: 'Riquelme' } })], list('A', [jugador]), list('B', [otro]), 'T')
    expect(fields).toBeNull()
    expect(items[0].extra).toEqual({ j2: 'Riquelme' })
  })

  it('no mueve nada a la misma lista ni ítems de otra lista', () => {
    expect(planMove([item({})], list('A'), list('A'), 'T').items).toEqual([])
    expect(planMove([item({ listId: 'C' })], list('A'), list('B'), 'T').items).toEqual([])
  })
})

describe('isEmoji', () => {
  it('acepta un emoji, con tono de piel, bandera o compuesto', () => {
    for (const e of ['⚽', ' 🏆 ', '👍🏽', '🇦🇷', '👨‍👩‍👧', '🏎️']) expect(isEmoji(e)).toBe(true)
  })
  it('rechaza texto, varios emojis o vacío', () => {
    for (const e of ['', 'A', 'Boca', '⚽⚽', '1']) expect(isEmoji(e)).toBe(false)
  })
})

describe('validateCollection', () => {
  it('el ícono de la lista tiene que ser un solo emoji', () => {
    expect(validateCollection({ name: 'Boca', emoji: ' 💙 ' }).emoji).toBe('💙')
    expect(() => validateCollection({ name: 'Boca', emoji: 'B' })).toThrow(ValidationError)
    expect(validateCollection({ name: 'Boca' })).toEqual({ name: 'Boca' })
  })
})
