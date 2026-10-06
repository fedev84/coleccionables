/**
 * Arte del ícono en SVG (fuente única de verdad).
 * Lienzo 1024 = 108dp del ícono adaptativo de Android.
 * Zona segura: círculo de 66dp (≈626px) en el centro — el arte queda adentro.
 * Camiseta blanca con un tilde ("la tengo") sobre el verde de la app.
 */

export const COLORS = {
  bgFrom: '#22c55e',
  bgTo: '#15803d',
  check: '#15803d',
  splashLight: '#f6f7f6',
  splashDark: '#0e0f0e',
}

// Escalada para dejar margen dentro de la zona segura.
const FIT = 'translate(512 512) scale(0.97) translate(-512 -525)'

// Mangas, cuerpo con puntas redondeadas y cuello en curva.
const SHIRT =
  'M 430 260 L 330 296 Q 312 302 300 318 L 238 400 Q 228 414 242 424 L 310 470 Q 322 478 332 468 L 362 432 ' +
  'L 362 766 Q 362 790 386 790 L 638 790 Q 662 790 662 766 L 662 432 L 692 468 Q 702 478 714 470 L 782 424 ' +
  'Q 796 414 786 400 L 724 318 Q 712 302 694 296 L 594 260 Q 512 332 430 260 Z'
const CHECK = 'M 432 560 L 494 622 L 602 504'

const svg = (body, size = 1024) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">${body}</svg>`

const defs = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${COLORS.bgFrom}"/><stop offset="1" stop-color="${COLORS.bgTo}"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="16" stdDeviation="20" flood-color="#052e16" flood-opacity="0.3"/>
    </filter>
    <mask id="cut">
      <rect width="1024" height="1024" fill="#fff"/>
      <path d="${CHECK}" fill="none" stroke="#000" stroke-width="52" stroke-linecap="round" stroke-linejoin="round"/>
    </mask>
  </defs>`

const shirt = `
  <g transform="${FIT}">
    <path d="${SHIRT}" fill="#fff" filter="url(#shadow)"/>
    <path d="${CHECK}" fill="none" stroke="${COLORS.check}" stroke-width="52" stroke-linecap="round" stroke-linejoin="round"/>
  </g>`

/** Capa de fondo: gradiente verde + brillo suave. */
export const background = (size) =>
  svg(`${defs}
    <rect width="1024" height="1024" fill="url(#bg)"/>
    <circle cx="840" cy="170" r="300" fill="#fff" fill-opacity="0.12"/>`, size)

/** Capa de frente: camiseta con tilde, sobre transparente. */
export const foreground = (size) => svg(`${defs}${shirt}`, size)

/** Íconos temáticos de Android 13+: silueta de un color, tilde calado. */
export const monochrome = (size) =>
  svg(`${defs}<g transform="${FIT}"><path d="${SHIRT}" fill="#fff" mask="url(#cut)"/></g>`, size)

/** Ícono completo (fondo + frente) para launchers viejos, Play Store y el splash. */
export const full = (size) =>
  svg(`${defs}
    <rect width="1024" height="1024" fill="url(#bg)"/>
    <circle cx="840" cy="170" r="300" fill="#fff" fill-opacity="0.12"/>${shirt}`, size)
