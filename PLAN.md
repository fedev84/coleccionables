# Plan — Colección

App Android liviana para organizar colecciones (empezando por camisetas de fútbol): listas propias, qué tengo y qué me falta, buscar y ordenar. Todo local, exportable.

## Modelo de datos

**Lista**: nombre, emoji (opcional), orden en el home.

**Ítem**: nombre y estado siempre; el resto son campos fijos que cada lista puede ocultar o renombrar, más campos propios (texto o número) en "Campos de la lista".

| Campo | Tipo | Nota |
|---|---|---|
| Nombre | texto, **obligatorio** | Lo que se ve en negrita en la lista |
| Estado | **Tengo / Me falta** | Pasar de "falta" a "tengo" con un toque |
| Foto | imagen comprimida | Cámara o galería; grande aparte + miniatura para la lista |
| Año de salida | número | |
| Versión | texto + sugerencias | Titular, Suplente, Alternativa, Arquero, Retro… |
| Tamaño | texto + sugerencias | S, M, L, XL… (texto libre por si es otra cosa) |
| Original o réplica | `original` / `replica` / sin dato | Dos botones; en la lista solo se marca "Réplica" |
| Personalización | texto + atajos | Dorsal, parches, firma ("Dorsal 10 · Firmada") |
| Precio pagado | número | Acepta "25.000" o "1.234,50" |
| Dónde lo compré | texto + sugerencias | |
| URL | link | Se normaliza (`sitio.com` → `https://sitio.com`) |
| Descripción corta | texto | |
| Campos propios | texto o número | Por lista, en el orden que elijas |

**Fila de lista**: miniatura a la izquierda · nombre · una línea con todo lo demás:
`2014 · Titular · L · Copa del Mundo, con parche` + marca "Falta" si corresponde.

## Etapas

### Etapa 0 — Base ✅
- Proyecto Vue 3 + Ionic 9 + Capacitor 8, plataforma Android.
- SQLite local con migraciones, estructura por capas (igual que Recomendame).
- Pantalla de inicio vacía. `npm run build` pasa.

### Etapa 1 — Listas e ítems ✅ (2026-10-02)
- Home: listas con contador "tengo X · faltan Y". Crear, renombrar, borrar (con confirmación), reordenar (botón "Ordenar").
- Dentro de una lista: filas con el formato de arriba (placeholder en vez de foto).
- Alta/edición de ítem en un panel con todos los campos. Borrar con "Deshacer".
- Marcar tengo/falta con swipe a la derecha (con "Deshacer"); borrar con swipe a la izquierda.
- Tests del dominio (validación, armado de la línea de descripción).

### Etapa 2 — Fotos ✅ (2026-10-02)
- Sacar foto o elegir de la galería (`@capacitor/camera`).
- Se comprime en el teléfono: foto ~1024 px (~100 KB) + miniatura ~160 px (~8 KB) para la lista.
- Tocar la miniatura = ver la foto grande. Cambiar / quitar foto.
- Probado en el emulador de Android: cámara → foto comprimida → guardada → miniatura en la lista.

### Etapa 3 — Buscar, filtrar y ordenar ✅ (2026-10-02)
- Buscador dentro de cada lista y **global** (en todas las listas).
- Busca en nombre, descripción, versión, tamaño y año, sin importar tildes ni el orden de las palabras.
- Filtro: Todos / Tengo / Me falta.
- Orden por: nombre, año, versión, tamaño, fecha de carga, última edición — ascendente o descendente.
- Cada lista recuerda su orden y filtro. Lo que no tiene el dato va siempre al final; los talles se ordenan XS → XXL.

### Etapa 4 — Exportar / importar ✅ (2026-10-02)
- **JSON completo** (con fotos) para backup o pasar a otro teléfono. Opción **sin fotos** (mucho más chico).
- **CSV** para abrir en una planilla.
- Exportar por el share sheet de Android (Drive, WhatsApp, mail).
- Importar con merge sin duplicar (se reusa la lógica probada de Recomendame) y resumen antes de confirmar.
- Probado en el emulador: el backup completo se escribe y abre el share sheet de Android.

### Etapa 5 — Pulido y publicación (si querés)
- ✅ Ícono y splash (2026-10-05): camiseta blanca con tilde sobre verde. Se regeneran con `npm run assets` desde `scripts/assets/art.mjs`.
- Nombre final.
- `appId` definitivo (hoy `com.fedev84.coleccion`, provisorio).
- Firma de release y ficha de Play Store.

## Extras ✅ (2026-10-02)
- **Campos por lista** (⋮ → "Campos de la lista"): ocultar o renombrar los de fábrica y sumar campos propios (texto o número). Se ven en el formulario, la línea de info, la búsqueda, el orden, el backup y la planilla.
- **Precio pagado** (acepta "25.000" o "1.234,50") y **dónde lo compré** (con sugerencias de lo ya usado).
- **Duplicar** un ítem desde su formulario: copia datos y foto, para cargar otra versión rápido.
- **Compartir lo que me falta / lo que tengo** como texto (WhatsApp, etc.), en el orden de la lista y sin precio ni lugar.

- **Ordenar los campos propios** ✅ (2026-10-05): arrastrando desde ≡ en "Campos de la lista".
- **Compartir como imagen** ✅ (2026-10-05): "Compartir lo que me falta / tengo" pregunta *Como texto* o *Como imagen (con fotos)*. Probado en el emulador.
- **Original o réplica** ✅ (2026-10-06): campo fijo con dos botones; en la lista se marca solo la réplica.
- **Personalización** ✅ (2026-10-08): texto libre con atajos Dorsal / Parche / Firmada; va en la línea de info y en lo que se comparte.

## Ideas para después (no se hacen salvo que lo pidas)
- Elegir qué incluir en la imagen (por ejemplo, sumar el precio).
