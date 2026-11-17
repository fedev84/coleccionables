import { fold } from './query'

/** Sugerencias para los campos de texto: las que ya usaste primero, después las de base. */
export const BASE_VERSIONS = ['Titular', 'Suplente', 'Alternativa', 'Arquero', 'Retro', 'Entrenamiento']
export const BASE_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

export const LIST_EMOJIS = [
  '👕', '⚽', '🏆', '🧤', '🎽', '🧢',
  '👟', '🏀', '🎾', '🏉', '🏎️', '🥇',
  '🃏', '🎴', '💿', '📼', '📚', '🎮',
  '🧸', '🚗', '🪙', '📮', '🖼️', '⭐',
]

/** Un solo emoji (con sus variantes: tono de piel, banderas, ZWJ). Para el ícono "Otro" de una lista. */
export function isEmoji(raw: string): boolean {
  const s = raw.trim()
  if (!s) return false
  const graphemes = [...new Intl.Segmenter('es', { granularity: 'grapheme' }).segment(s)]
  return graphemes.length === 1 && /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(s)
}

/** Une sin repetir (sin importar mayúsculas) y filtra por lo tipeado. */
export function suggest(used: string[], base: string[], typed: string, max = 8): string[] {
  const q = typed.trim().toLowerCase()
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of [...used, ...base]) {
    const k = v.toLowerCase()
    if (seen.has(k) || k === q || (q && !k.includes(q))) continue
    seen.add(k)
    out.push(v)
  }
  return out.slice(0, max)
}

/** Talles en su orden natural (XS → XXL), no en el de uso; los que no son de la escala van después, como vinieron. */
export function sortSizes(sizes: string[]): string[] {
  const rank = (v: string) => {
    const n = BASE_SIZES.indexOf(v.trim().toUpperCase())
    return n === -1 ? BASE_SIZES.length : n
  }
  return sizes.map((v, i) => ({ v, i })).sort((a, b) => rank(a.v) - rank(b.v) || a.i - b.i).map((x) => x.v)
}

/**
 * Nombres ya usados que siguen a lo tipeado (desde 2 letras, sin mayúsculas ni tildes): primero los que empiezan así,
 * después los que tienen una palabra que empieza así ("jun" → "Boca Juniors"). `names` ya viene ordenado por relevancia.
 */
export function nameSuggestions(names: string[], typed: string, max = 4): string[] {
  const q = fold(typed.trim())
  if (q.length < 2) return []
  const starts: string[] = []
  const words: string[] = []
  for (const n of names) {
    const f = fold(n)
    if (f === q) continue
    if (f.startsWith(q)) starts.push(n)
    else if (f.split(/[\s\-/.()]+/).some((w) => w.startsWith(q))) words.push(n)
  }
  return [...starts, ...words].slice(0, max)
}
