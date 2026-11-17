/** Cuánto hay que mantener apretado. Igual que en las filas de ítems. */
const LONG_PRESS_MS = 450

/**
 * Mantener apretado sobre algo que también se toca (una lista de varios: `on(x)` da los handlers de cada uno).
 * Si el dedo se mueve (scroll), no cuenta; y el click que llega al soltar se ignora (`tapped` devuelve false).
 */
export function useLongPress<T>(onLong: (target: T) => void) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let start = { x: 0, y: 0 }
  let fired = false

  const cancel = () => clearTimeout(timer)
  const on = (target: T) => ({
    onPointerdown(e: PointerEvent) {
      fired = false
      start = { x: e.clientX, y: e.clientY }
      cancel()
      timer = setTimeout(() => { fired = true; onLong(target) }, LONG_PRESS_MS)
    },
    onPointermove(e: PointerEvent) {
      if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) cancel()
    },
    onPointerup: cancel,
    onPointercancel: cancel,
    onPointerleave: cancel,
    // El menú del sistema (mouse derecho, o Android al mantener) también abre el nuestro.
    onContextmenu(e: Event) {
      e.preventDefault()
      if (!fired) { cancel(); fired = true; onLong(target) }
    },
  })
  return {
    on,
    /** Para el click: false si fue el final de un "mantener apretado". */
    tapped() {
      if (!fired) return true
      fired = false
      return false
    },
  }
}
