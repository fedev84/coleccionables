/** Números como se escriben en Argentina: "25.000", "1.234,50", "$ 3500". */

export function parseNumber(raw: string | number | null | undefined): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : NaN
  let v = (raw ?? '').replace(/[\s$]/g, '')
  if (!v) return null
  if (v.includes(',')) v = v.replace(/\./g, '').replace(',', '.') // coma decimal: los puntos son de miles
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(v)) v = v.replace(/\./g, '') // "25.000" = veinticinco mil
  const n = Number(v)
  return /^-?\d+(\.\d+)?$/.test(v) && Number.isFinite(n) ? n : NaN
}

const fmt = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 })
export const formatNumber = (n: number) => fmt.format(n)
export const formatPrice = (n: number) => `$ ${fmt.format(n)}`
