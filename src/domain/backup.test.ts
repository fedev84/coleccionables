import { describe, expect, it } from 'vitest'
import type { Collection, Item } from './models'
import { BackupError, buildBackup, parseBackup, planImport, serializeBackup } from './backup'
import { buildCsv } from './csv'
import { defaultFields } from './fields'

const list: Collection = { id: 'L1', name: 'Camisetas', emoji: '👕', fields: defaultFields(), sortOrder: 0, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }
const boca: Item = {
  id: 'I1', listId: 'L1', name: 'Boca', status: 'have', year: 2014, version: 'Titular', size: 'L', url: null,
  description: 'Con "parche"; firmada', price: 25000.5, place: 'Feria', extra: {}, thumb: 'data:image/jpeg;base64,T', createdAt: '2026-01-02T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z',
}
const photos = new Map([['I1', 'data:image/jpeg;base64,FULL']])
const roundTrip = (withPhotos: boolean) => parseBackup(serializeBackup(buildBackup([list], [boca], withPhotos ? photos : null)))

describe('backup', () => {
  it('con fotos ida y vuelta conserva todo', () => {
    const [l] = roundTrip(true)
    expect(l).toMatchObject({ id: 'L1', name: 'Camisetas' })
    expect(l.items[0]).toMatchObject({ id: 'I1', name: 'Boca', year: 2014, price: 25000.5, place: 'Feria', thumb: boca.thumb, photo: 'data:image/jpeg;base64,FULL' })
  })

  it('sin fotos no lleva imágenes', () => {
    const item = roundTrip(false)[0].items[0]
    expect(item.thumb).toBeUndefined()
    expect(item.photo).toBeUndefined()
  })

  it('acepta un archivo escrito a mano y descarta datos inválidos', () => {
    const [l] = parseBackup('{"lists":[{"name":"Mías","items":[{"name":"River","year":"1986","url":"no es link"},{"year":2000}]}]}')
    expect(l.items).toHaveLength(1)
    expect(l.items[0]).toMatchObject({ id: null, name: 'River', year: 1986, url: null, status: 'have' })
  })

  it('rechaza archivos de otra app o que no son JSON', () => {
    expect(() => parseBackup('hola')).toThrow(BackupError)
    expect(() => parseBackup('{"app":"recos","lists":[]}')).toThrow(BackupError)
  })
})

describe('planImport', () => {
  it('reimportar lo mismo no duplica ni cambia nada', () => {
    const plan = planImport(roundTrip(true), [list], [boca])
    expect(plan.summary).toEqual({ listsAdded: 0, itemsAdded: 0, itemsUpdated: 0, unchanged: 1 })
    expect(plan.items).toEqual([])
  })

  it('sin ids matchea por nombre de lista y nombre + año + versión', () => {
    const incoming = parseBackup(JSON.stringify({ lists: [{ name: 'camisetas', items: [
      { name: 'BOCA', year: 2014, version: 'titular', updatedAt: '2026-06-01T00:00:00Z', description: 'nueva' },
      { name: 'Boca', year: 2014, version: 'Suplente' },
    ] }] }))
    const plan = planImport(incoming, [list], [boca])
    expect(plan.summary).toEqual({ listsAdded: 0, itemsAdded: 1, itemsUpdated: 1, unchanged: 0 })
    const updated = plan.items.find((w) => w.item.id === 'I1')!
    expect(updated.item.description).toBe('nueva')
    // Sin foto en el archivo: conserva la miniatura y no toca la foto grande.
    expect(updated.item.thumb).toBe(boca.thumb)
    expect(updated.photo).toBeUndefined()
  })

  it('dos ítems iguales del archivo (otro id, p. ej. dos talles) no se funden en uno', () => {
    const twins = { lists: [{ name: 'Camisetas', items: [
      { id: 'A', name: 'Boca', year: 2014, version: 'Titular', size: 'M' },
      { id: 'B', name: 'Boca', year: 2014, version: 'Titular', size: 'XL' },
    ] }] }
    // En un teléfono vacío entran los dos.
    expect(planImport(parseBackup(JSON.stringify(twins)), [], []).summary.itemsAdded).toBe(2)
    // Con una igual en el teléfono: una se empareja con la local y la otra entra nueva.
    expect(planImport(parseBackup(JSON.stringify(twins)), [list], [boca]).summary).toEqual({ listsAdded: 0, itemsAdded: 1, itemsUpdated: 0, unchanged: 1 })
  })

  it('lo local más nuevo no se pisa', () => {
    const incoming = parseBackup(JSON.stringify({ lists: [{ id: 'L1', name: 'Camisetas', items: [{ id: 'I1', name: 'Viejo', updatedAt: '2025-01-01T00:00:00Z' }] }] }))
    expect(planImport(incoming, [list], [boca]).summary.unchanged).toBe(1)
  })

  it('suma los campos propios que trae el archivo aunque la lista local sea más nueva', () => {
    const incoming = parseBackup(JSON.stringify({ lists: [{ id: 'L1', name: 'Camisetas', updatedAt: '2020-01-01T00:00:00Z',
      fields: { custom: [{ id: 'd', label: 'Dorsal', type: 'number' }] }, items: [] }] }))
    const plan = planImport(incoming, [list], [])
    expect(plan.lists[0].fields.custom).toEqual([{ id: 'd', label: 'Dorsal', type: 'number' }])
    expect(plan.lists[0].name).toBe('Camisetas')
  })

  it('lee precio, lugar y campos propios', () => {
    const [l] = parseBackup('{"lists":[{"name":"X","items":[{"name":"A","price":"25.000","place":" Feria ","extra":{"d":10,"e":" ","f":"ok"}}]}]}')
    expect(l.items[0]).toMatchObject({ price: 25000, place: 'Feria', extra: { d: 10, f: 'ok' } })
  })

  it('una lista nueva va al final', () => {
    const plan = planImport(parseBackup('{"lists":[{"name":"Figuritas"}]}'), [list], [])
    expect(plan.lists[0]).toMatchObject({ name: 'Figuritas', sortOrder: 1 })
  })
})

describe('buildCsv', () => {
  it('escapa comillas y separadores, con BOM', () => {
    const csv = buildCsv([list], [boca])
    expect(csv.startsWith('﻿Lista;Nombre;Estado')).toBe(true)
    expect(csv).toContain('Camisetas;Boca;Tengo;2014;Titular;L;25000,5;Feria;;"Con ""parche""; firmada";;2026-01-02;2026-01-02')
  })
})
