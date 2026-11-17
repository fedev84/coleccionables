/**
 * "Pegar una lista": un texto con una pieza por renglón (notas, WhatsApp…) → piezas para agregar.
 * De cada renglón se saca el año (4 cifras, 1900–2099) y, si termina en una versión conocida, la versión;
 * lo que queda es el nombre. Ver `planPaste` para lo que ya está y los repetidos.
 */
import type { Item } from './models'
import { identityKey } from './identity'
import { fold } from './query'

export interface PastedItem {
  name: string
  year: number | null
  version: string | null
}

export interface PasteOptions {
  /** false si la lista no usa año: queda todo en el nombre. */
  year: boolean
  /** Versiones que se reconocen al final del renglón; null si la lista no usa versión. */
  versions: string[] | null
}

/** Viñetas, números ("1.", "2)"), casillas y tildes al principio del renglón. */
const BULLET = /^\s*(?:[-–—•·▪◦*+>]|\d{1,3}[.)]|\[[ xX✓✔]?\]|[☐☑✅✔✓])\s*/
/** Año suelto; una temporada "2006/07" o "2006-2007" cuenta como 2006. */
const YEAR = /(^|[\s,(])((?:19|20)\d{2})(?:[/-]\d{2}(?:\d{2})?)?(?=$|[\s,)])/
const EDGES = /^[\s\-–—,·|:;]+|[\s\-–—,·|:;]+$/g

const tidy = (s: string) => s.replace(/\(\s*\)/g, ' ').replace(/\s+/g, ' ').replace(EDGES, '')

export function parseLine(line: string, opts: PasteOptions): PastedItem | null {
  // "Lo que me falta:" es un título, no una pieza.
  if (/:\s*$/.test(line)) return null
  // Negrita, cursiva y tachado de WhatsApp.
  let s = line.replace(/[*_~]/g, ' ')
  while (BULLET.test(s) && s.replace(BULLET, '') !== s) s = s.replace(BULLET, '')
  s = tidy(s)

  let year: number | null = null
  const m = opts.year ? YEAR.exec(s) : null
  if (m) {
    year = Number(m[2])
    s = tidy(`${s.slice(0, m.index)}${m[1]} ${s.slice(m.index + m[0].length)}`)
  }

  let version: string | null = null
  if (opts.versions) {
    // "(Titular)" al final vale igual que "Titular".
    const bare = tidy(s.replace(/\(([^()]*)\)\s*$/, ' $1'))
    const folded = fold(bare)
    const found = [...opts.versions]
      .sort((a, b) => b.length - a.length)
      .find((v) => {
        const fv = fold(v.trim())
        return fv && folded.length > fv.length && folded.endsWith(fv) && /[\s\-–—,·|:;]/.test(folded[folded.length - fv.length - 1])
      })
    if (found) {
      version = found.trim()
      s = tidy(bare.slice(0, bare.length - found.trim().length))
    }
  }

  return s ? { name: s, year, version } : null
}

export interface PasteRow extends PastedItem {
  key: string
  /** Ya hay una pieza igual (nombre + año + versión) en la lista: no se agrega. */
  exists: boolean
}

export interface PastePlan {
  rows: PasteRow[]
  /** Renglones que repetían una pieza de más arriba en el mismo texto: se cargan una sola vez. */
  repeated: number
}

export function planPaste(text: string, opts: PasteOptions, existing: Item[]): PastePlan {
  const taken = new Set(existing.map(identityKey))
  const seen = new Set<string>()
  const rows: PasteRow[] = []
  let repeated = 0
  for (const line of text.split(/\r?\n/)) {
    const item = parseLine(line, opts)
    if (!item) continue
    const key = identityKey(item)
    if (seen.has(key)) {
      repeated++
      continue
    }
    seen.add(key)
    rows.push({ ...item, key, exists: taken.has(key) })
  }
  return { rows, repeated }
}
