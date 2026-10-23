# Play Store: Coleccionables

Todo lo que se carga en Play Console, en el orden en que lo pide. Si cambia qué datos usa la app, actualizar a la vez este archivo, la página de privacidad (`site/privacidad/`) y el formulario de Seguridad de los datos: tienen que decir lo mismo.

## 1. Crear la app

Play Console → **Crear app**.

| Campo | Valor |
|---|---|
| Nombre de la app | `Coleccionables` |
| Idioma predeterminado | Español (Latinoamérica) – es-419 |
| App o juego | App |
| Gratis o pagada | Gratis (no se puede pasar a pagada después) |
| Declaraciones | Tildar las dos: Políticas del programa para desarrolladores y leyes de exportación de EE.UU. |

## 2. Ficha principal

Play Console → Crecer → Presencia en Play Store → **Ficha de Play Store principal**.

**Nombre** (14/30)

```text
Coleccionables
```

**Descripción breve** (68/80)

```text
Camisetas, figuritas, vinilos: anotá lo que tenés y lo que te falta.
```

**Descripción completa**

```text
¿Coleccionás camisetas, figuritas, vinilos, autitos o lo que sea? Coleccionables te ayuda a tener todo ordenado en el teléfono: qué tenés, qué te falta y los detalles de cada pieza.

📋 LISTAS A TU MEDIDA
Armá una lista por colección, con el ícono que quieras. Cada lista tiene sus campos: año, versión, talle, original o réplica, personalización (dorsal, parches, firma), precio, dónde lo compraste… Ocultá los que no uses, cambiales el nombre o sumá los tuyos.

📷 CON FOTOS
Sacale una foto a cada pieza o elegila de la galería. Se guarda comprimida para que no ocupe lugar.

✅ TENGO / ME FALTA
Marcá con un toque lo que conseguiste. Compartí lo que te falta por WhatsApp, como texto o como imagen con fotos, para que te ayuden a buscarlo.

🔍 BUSCÁ Y ORDENÁ
Buscá en una lista o en todas a la vez, y ordená por nombre, año, talle, precio y más.

🔀 REORGANIZÁ
Mové piezas de una lista a otra o partí una lista en dos en un par de toques. Duplicá una pieza para cargar otra versión rápido.

🔒 TUS DATOS SON TUYOS
Todo se guarda en tu teléfono: sin cuentas, sin publicidad, sin nube. Exportá un backup con fotos para pasarlo a otro teléfono, o una planilla para abrir en Excel o Google Sheets.

🌙 MODO OSCURO
Se adapta solo al tema de tu teléfono.

Liviana y simple, para tener tu colección siempre a mano.
```

**Gráficos** (se generan en la entrega 3)

| Campo | Archivo | Tamaño |
|---|---|---|
| Ícono de la app | `icon-512.png` | 512×512 |
| Gráfico de funciones | `play/feature-graphic.png` | 1024×500 |
| Capturas de teléfono (en este orden) | `play/01-…png` en adelante | 1080×1920 |

## 3. Categoría y contacto

Play Console → Crecer → Presencia en Play Store → **Configuración de la tienda**.

- **Categoría:** Estilo de vida.
- **Etiquetas** (opcional): Colecciones, Hobbies, Organizador.
- **Email:** `loartesanal.rock@gmail.com`
- **Sitio web:** `https://fedev84.github.io/coleccionables/`

## 4. Contenido de la app

Play Console → Política → **Contenido de la app**. Una sección por vez:

| Sección | Respuesta |
|---|---|
| Política de privacidad | `https://fedev84.github.io/coleccionables/privacidad/` (se publica en la entrega 2). |
| Acceso a la app | **Toda la funcionalidad está disponible sin acceso especial.** No hay login. |
| Anuncios | **No**, la app no tiene anuncios. |
| Clasificación del contenido | Email: `loartesanal.rock@gmail.com`. Categoría: **Todos los demás tipos de apps**. Violencia, sexo, lenguaje, drogas, apuestas y el resto: **No** a todo. ¿Los usuarios interactúan o comparten contenido entre sí dentro de la app? **No**: "Compartir" solo abre el menú de Android para mandar un texto o una imagen por otra app. Compras digitales, ubicación, navegador web: **No**. Resultado esperado: apta para todo público. |
| Público objetivo | **13-15, 16-17 y 18 o más** (sin menores de 13, así no aplica la política de Familias). ¿Puede atraer a niños sin querer? **No**. |
| Apps de noticias | No. |
| ID de publicidad | **No** usa el ID de publicidad. |
| Apps gubernamentales | No. |
| Funciones financieras | "Mi app no ofrece funciones financieras". El precio pagado es solo un dato que anota el usuario. |
| Apps de salud | No tiene funciones de salud. |

### Seguridad de los datos

- ¿Recopila o comparte alguno de los tipos de datos obligatorios? **No.**
- Por qué: todo (listas, ítems y fotos) se guarda en una base local del teléfono. La app no tiene servidor, cuentas, publicidad, analíticas ni registro de fallas, y no manda nada por internet.
- Las fotos las saca la cámara o las elige el usuario de la galería; se comprimen y se guardan en el teléfono.
- El backup lo exporta el usuario a donde elija (Drive, WhatsApp, mail): eso lo decide y lo hace él, no la app, así que no cuenta como compartir.
- El resumen que muestra Play queda: "No se recopilan datos" y "No se comparten datos con terceros".

## 5. Versión, prueba y lanzamiento (al final, con el AAB)

- **Países:** Argentina para empezar (la app está en castellano rioplatense). Se pueden sumar después sin subir otra versión.
- **Prueba cerrada obligatoria:** la cuenta de desarrollador es personal y nueva, así que para pasar a producción Google exige una prueba cerrada con **12 testers o más durante 14 días seguidos**. Conviene invitar unos 15. Ver la Etapa 6 de `gastos/docs/plan-publicacion-play-store.md`: es el mismo procedimiento.
- **Notas de la versión** (1.1.0):

```text
<es-419>
Primera versión de Coleccionables:
• Listas para cada colección, con el ícono y los campos que quieras.
• Fotos de cada pieza, tengo / me falta y búsqueda en todas las listas.
• Compartí lo que te falta como texto o como imagen.
• Mové piezas entre listas y hacé backup con fotos.
</es-419>
```
