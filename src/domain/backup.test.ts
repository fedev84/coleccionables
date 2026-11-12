import { describe, expect, it } from 'vitest'
import type { Collection, Item } from './models'
import { BackupError, buildBackup, parseBackup, planImport, serializeBackup, resolveImport } from './backup'
import { buildCsv } from './csv'
import { defaultFields } from './fields'

const list: Collection = { id: 'L1', name: 'Camisetas', emoji: '👕', fields: defaultFields(), sortOrder: 0, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }
const boca: Item = {
  id: 'I1', listId: 'L1', name: 'Boca', status: 'have', year: 2014, version: 'Titular', size: 'L', url: null,
  description: 'Con "parche"; firmada', price: 25000.5, place: 'Feria', authenticity: 'replica', customization: '10 Riquelme', extra: {}, goneAt: null, goneReason: null, thumb: 'data:image/jpeg;base64,T', createdAt: '2026-01-02T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z',
}
const photos = new Map([['I1', ['data:image/jpeg;base64,FULL', 'data:image/jpeg;base64,DOS']]])
const roundTrip = (withPhotos: boolean) => parseBackup(serializeBackup(buildBackup([list], [boca], withPhotos ? photos : null)))

describe('backup', () => {
  it('con fotos ida y vuelta conserva todo', () => {
    const [l] = roundTrip(true)
    expect(l).toMatchObject({ id: 'L1', name: 'Camisetas' })
    expect(l.items[0]).toMatchObject({ id: 'I1', name: 'Boca', year: 2014, authenticity: 'replica', customization: '10 Riquelme', price: 25000.5, place: 'Feria', thumb: boca.thumb, photo: 'data:image/jpeg;base64,FULL', morePhotos: ['data:image/jpeg;base64,DOS'] })
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
    expect(plan.summary).toEqual({ listsAdded: 0, itemsAdded: 0, conflicts: 0, unchanged: 1, renamed: 0 })
    expect(plan.items).toEqual([])
    expect(plan.conflicts).toEqual([])
  })

  it('sin ids matchea por nombre de lista y nombre + año + versión', () => {
    const incoming = parseBackup(JSON.stringify({ lists: [{ name: 'camisetas', items: [
      { name: 'BOCA', year: 2014, version: 'titular', updatedAt: '2026-06-01T00:00:00Z', description: 'nueva' },
      { name: 'Boca', year: 2014, version: 'Suplente' },
    ] }] }))
    const plan = planImport(incoming, [list], [boca])
    expect(plan.summary).toEqual({ listsAdded: 0, itemsAdded: 1, conflicts: 1, unchanged: 0, renamed: 0 })
    // Datos distintos: no se pisa solo, se pregunta (y se sugiere el más nuevo, el del backup).
    expect(plan.conflicts[0].suggested).toBe('backup')
    const updated = resolveImport(plan, []).find((w) => w.item.id === 'I1')!
    expect(updated.item.description).toBe('nueva')
    // Sin foto en el archivo: conserva la miniatura y no toca la foto grande.
    expect(updated.item.thumb).toBe(boca.thumb)
    expect(updated.photos).toBeUndefined()
  })

  it('dos ítems iguales del archivo (otro id, p. ej. dos talles) no se funden en uno', () => {
    const twins = { lists: [{ name: 'Camisetas', items: [
      { id: 'A', name: 'Boca', year: 2014, version: 'Titular', size: 'M' },
      { id: 'B', name: 'Boca', year: 2014, version: 'Titular', size: 'XL' },
    ] }] }
    // En un teléfono vacío entran los dos, el segundo como "Boca (2)" para no repetir nombre + año + versión.
    const empty = planImport(parseBackup(JSON.stringify(twins)), [], [])
    expect(empty.items.map((w) => w.item.name)).toEqual(['Boca', 'Boca (2)'])
    // Con una igual en el teléfono: una se empareja con la local (y pregunta, porque cambia el talle) y la otra entra nueva.
    expect(planImport(parseBackup(JSON.stringify(twins)), [list], [boca]).summary).toEqual({ listsAdded: 0, itemsAdded: 1, conflicts: 1, unchanged: 0, renamed: 1 })
  })

  it('si lo del teléfono es más nuevo, sugiere quedarse con eso; si elegís el backup, lo pisa', () => {
    const incoming = parseBackup(JSON.stringify({ lists: [{ id: 'L1', name: 'Camisetas', items: [{ id: 'I1', name: 'Viejo', updatedAt: '2025-01-01T00:00:00Z' }] }] }))
    const plan = planImport(incoming, [list], [boca])
    expect(plan.conflicts[0].suggested).toBe('phone')
    expect(resolveImport(plan, [])).toEqual([])
    expect(resolveImport(plan, ['backup'])[0].item).toMatchObject({ id: 'I1', name: 'Viejo' })
  })

  it('lee "Tuve" con su fecha y motivo; fuera de "Tuve" los descarta', () => {
    const [l] = parseBackup(JSON.stringify({ lists: [{ name: 'X', items: [
      { name: 'A', status: 'gone', goneAt: '2025-03-12', goneReason: 'Regalada' },
      { name: 'B', status: 'have', goneAt: '2025-03-12', goneReason: 'x' },
      { name: 'C', status: 'gone', goneAt: 'ayer' },
    ] }] }))
    expect(l.items.map((i) => [i.status, i.goneAt, i.goneReason])).toEqual([['gone', '2025-03-12', 'Regalada'], ['have', null, null], ['gone', null, null]])
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

  it('original o réplica: tolera tildes y mayúsculas, y descarta lo desconocido', () => {
    const [l] = parseBackup('{"lists":[{"name":"X","items":[{"name":"A","authenticity":"Réplica"},{"name":"B","authenticity":" ORIGINAL "},{"name":"C","authenticity":"trucha"},{"name":"D"}]}]}')
    expect(l.items.map((i) => i.authenticity)).toEqual(['replica', 'original', null, null])
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
    expect(csv).toContain('Camisetas;Boca;Tengo;2014;Titular;L;Réplica;10 Riquelme;25000,5;Feria;;"Con ""parche""; firmada";;;;2026-01-02;2026-01-02')
  })
})

describe('varias fotos', () => {
  it('importa todas en orden, y un backup viejo (una sola foto) también', () => {
    const plan = planImport(roundTrip(true), [], [])
    expect(plan.items[0].photos).toEqual(['data:image/jpeg;base64,FULL', 'data:image/jpeg;base64,DOS'])
    const old = parseBackup(JSON.stringify({ lists: [{ name: 'X', items: [{ name: 'A', thumb: 'data:image/jpeg;base64,T', photo: 'data:image/jpeg;base64,P' }] }] }))
    expect(planImport(old, [], []).items[0].photos).toEqual(['data:image/jpeg;base64,P'])
  })

  it('descarta lo que no es imagen y se queda con 5 como mucho', () => {
    const more = ['nada', ...Array.from({ length: 6 }, (_, n) => `data:image/jpeg;base64,${n}`)]
    const [l] = parseBackup(JSON.stringify({ lists: [{ name: 'X', items: [{ name: 'A', thumb: 'data:image/jpeg;base64,T', photo: 'data:image/jpeg;base64,P', morePhotos: more }] }] }))
    expect(l.items[0].morePhotos).toEqual(['0', '1', '2', '3'].map((n) => `data:image/jpeg;base64,${n}`))
  })
})
