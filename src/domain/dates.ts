/** Fechas para mostrar: "12/03/2025". */

/** De AAAA-MM-DD (fecha sin hora). */
export const formatDay = (day: string) => {
  const [y, m, d] = day.split('-')
  return d && m && y ? `${d}/${m}/${y}` : day
}

/** De un timestamp ISO, en la hora local. */
export const formatDate = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
