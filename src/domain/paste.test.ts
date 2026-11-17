import { describe, expect, it } from 'vitest'
import type { Item } from './models'
import { parseLine, planPaste, type PasteOptions } from './paste'

const SHIRTS: PasteOptions = { year: true, versions: ['Titular', 'Suplente', 'Alternativa', 'Arquero'] }
const p = (line: string, opts = SHIRTS) => parseLine(line, opts)

describe('parseLine', () => {
  it('saca año y versión del renglón', () => {
    expect(p('Boca Juniors 2007 Titular')).toEqual({ name: 'Boca Juniors', year: 2007, version: 'Titular' })
    expect(p('River 1986 suplente')).toEqual({ name: 'River', year: 1986, version: 'Suplente' })
    expect(p('Italia (2006) - Alternativa')).toEqual({ name: 'Italia', year: 2006, version: 'Alternativa' })
    expect(p('Argentina 1986 (Titular)')).toEqual({ name: 'Argentina', year: 1986, version: 'Titular' })
  })
  it('limpia viñetas, números y formato de WhatsApp', () => {
    expect(p('- Boca 2007')).toEqual({ name: 'Boca', year: 2007, version: null })
    expect(p('  3. *Chile* 1962 Titular')).toEqual({ name: 'Chile', year: 1962, version: 'Titular' })
    expect(p('• ✅ Brasil')).toEqual({ name: 'Brasil', year: null, version: null })
  })
  it('una temporada cuenta como su primer año', () => {
    expect(p('Barcelona 2010/11 Titular')).toEqual({ name: 'Barcelona', year: 2010, version: 'Titular' })
  })
  it('no confunde números que no son años ni nombres que son versiones', () => {
    expect(p('Colectivo 1:64')).toEqual({ name: 'Colectivo 1:64', year: null, version: null })
    expect(p('Titular')).toEqual({ name: 'Titular', year: null, version: null })
    expect(p('Boca Titulares')).toEqual({ name: 'Boca Titulares', year: null, version: null })
  })
  it('si la lista no usa año ni versión, queda todo en el nombre', () => {
    expect(p('Boca 2007 Titular', { year: false, versions: null })).toEqual({ name: 'Boca 2007 Titular', year: null, version: null })
  })
  it('salta renglones vacíos, de solo viñeta o títulos', () => {
    expect(p('Lo que me falta:')).toBeNull()
    expect(p('   ')).toBeNull()
    expect(p(' - ')).toBeNull()
  })
})

describe('planPaste', () => {
  const existing = [{ id: '1', listId: 'l', name: 'Boca Juniors', year: 2007, version: 'Titular' } as Item]
  it('marca lo que ya está y junta los repetidos del texto', () => {
    const plan = planPaste('Boca juniors 2007 titular\nRiver 1986\n\n- River 1986\nChile', SHIRTS, existing)
    expect(plan.rows.map((r) => [r.name, r.exists])).toEqual([['Boca juniors', true], ['River', false], ['Chile', false]])
    expect(plan.repeated).toBe(1)
  })
})
