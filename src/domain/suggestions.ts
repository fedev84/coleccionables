/** Sugerencias para los campos de texto: las que ya usaste primero, después las de base. */
export const BASE_VERSIONS = ['Titular', 'Suplente', 'Alternativa', 'Arquero', 'Retro', 'Entrenamiento']
export const BASE_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

export const LIST_EMOJIS = ['👕', '⚽', '🏆', '🧤', '🎽', '🧢', '👟', '🃏', '💿', '📚', '🎮', '⭐']

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
