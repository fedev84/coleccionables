# Decisiones — Coleccionables

Registro corto. Una fila = una decisión. Si cambia, se tacha y se agrega la nueva con fecha.

## Stack (2026-10-02)

| # | Decisión | Por qué | Alternativa descartada |
|---|---|---|---|
| 1 | **Ionic Vue 9 + Capacitor 8** (los dos) | No son alternativas: Ionic da los componentes (listas, paneles, swipe, navegación nativa); Capacitor empaqueta la app y da cámara/archivos. Misma base que Recomendame. | Solo Capacitor + UI a mano (más trabajo, menos nativo) |
| 2 | **Solo Android** por ahora | Se suma iOS con `npx cap add ios` sin tocar código. | — |
| 3 | **SQLite** local (`@capacitor-community/sqlite`) | Persistente y robusto. En web usa `jeep-sqlite` para desarrollar en el browser. | IndexedDB (el sistema lo puede borrar si falta espacio) |
| 4 | `sql.js` 1.11.0 y TypeScript 6 fijos | Igual que Recomendame: tienen que coincidir con `jeep-sqlite` y `vue-tsc`. | — |
| 5 | Sin fuentes extra, sin anuncios, sin confetti | Pediste liviana y funcional. | — |

## Arquitectura

```
views/ + components/  →  stores/ (Pinia)  →  services/  →  data/ports.ts (interfaces)
                                                               ↑
                                              data/sqlite/* (implementación)
app/container.ts = el único archivo que cablea las implementaciones
```

| # | Decisión | Qué implica |
|---|---|---|
| 6 | Repositorios detrás de interfaces | Cambiar la base = implementar `data/ports.ts` + tocar `app/container.ts`. |
| 7 | Dominio puro en `domain/` | Modelos y reglas sin Vue ni SQLite; se testean solos. |
| 8 | Textos en `copy/es.ts` | Un solo lugar para el tono. |
| 9 | Migraciones append-only (`PRAGMA user_version`) | Una migración publicada no se edita, se agrega otra. |
| 10 | IDs UUID + fechas ISO | Import/merge entre teléfonos sin choques. |

## Producto

| # | Decisión | Nota |
|---|---|---|
| 11 | Listas genéricas, no solo camisetas | Los campos sirven para cualquier colección; campos por lista queda para después. |
| 12 | Ítem con **nombre obligatorio** | No estaba en tu lista de campos, pero la fila lo muestra y sin él no se identifica. |
| 13 | Estado **Tengo / Me falta** en el mismo ítem | Lo que falta se carga igual y se pasa a "tengo" con un toque. |
| 14 | Fotos comprimidas dentro de la base (foto + miniatura) | Liviana, y el backup es un solo archivo. |

## Listas, ítems y fotos (2026-10-02)

| # | Decisión | Por qué |
|---|---|---|
| 15 | Dentro de la lista, orden alfabético por nombre | Provisorio hasta la Etapa 3 (ordenar por cualquier campo). |
| 16 | Swipe derecha = tengo ↔ me falta; swipe izquierda = borrar; los dos con "Deshacer" | Ágil, sin diálogos. Borrar una lista sí pide confirmación. |
| 17 | Versión y tamaño: texto libre + chips con lo que ya usaste primero y una base (Titular, Suplente…; XS–XXL) | Rápido de cargar sin encerrarte en una lista fija. |
| 18 | Foto grande: lado mayor 1200 px, JPEG 75 % (~100 KB). Miniatura: cuadrada 192 px recortada al centro (~5 KB) | La lista solo lee miniaturas, así que scrollea liviana; la grande se carga al tocarla. |
| 19 | Fotos en una tabla aparte (`photos`) | La lista no carga las fotos grandes. |
| 20 | Cámara y galería con `takePhoto` / `chooseFromGallery` de `@capacitor/camera` 8 | `getPhoto` está deprecado. Galería = Photo Picker de Android: sin permisos de almacenamiento. |
| 21 | El link se valida: sin espacios y con dominio con punto | `new URL()` aceptaba cualquier texto como link. |

## Buscar y ordenar (2026-10-02)

| # | Decisión | Por qué |
|---|---|---|
| 22 | Búsqueda y orden **en memoria** (`domain/query.ts`), no en SQL | Con cientos o pocos miles de ítems es instantáneo, y la lógica se testea sola. |
| 23 | Cada palabra tiene que aparecer en algún campo, sin tildes ni mayúsculas | "titular 86" encuentra "Argentina 1986 · Titular"; "atletico" encuentra "Atlético". |
| 24 | Elegir el orden actual lo invierte; las fechas arrancan de lo más nuevo | Un toque menos. También hay "Invertir orden". |
| 25 | Los ítems sin el dato van al final en los dos sentidos; talles en orden natural (XS → XXXL) | Ordenar por año no te llena el principio de ítems sin año. |
| 26 | Filtro y orden se guardan por lista en `meta` (no van al backup) | Es una preferencia de este teléfono, no un dato de la colección. |
| 27 | Búsqueda global en el home: muestra la lista de cada resultado y se edita ahí mismo | No hace falta entrar a cada lista. |

## Exportar / importar (2026-10-02)

| # | Decisión | Por qué |
|---|---|---|
| 28 | Backup **JSON** completo (fotos en base64 dentro del archivo) o **sin fotos** | Un solo archivo, fácil de guardar en Drive. El liviano sirve para el día a día. |
| 29 | Import: match por id; si no, lista por nombre e ítem por **nombre + año + versión**. Gana el `updatedAt` más nuevo | Distingue "Boca 2014 Titular" de "Boca 2014 Suplente". Reimportar no duplica. |
| 30 | Un backup sin fotos **nunca borra** fotos | Importar el liviano en el mismo teléfono no te deja sin fotos. |
| 31 | **CSV** con `;` y BOM, solo para exportar | El Excel en español separa con `;` y sin BOM rompe las tildes. Google Sheets detecta el `;` solo. |
| 32 | El archivo se escribe de a pedazos de 1 MB | Un backup con fotos puede pesar decenas de MB; así no se ahoga el puente nativo. |
| 33 | En web el dev server ignora `android/` | Compilar Android recargaba el navegador. |

## Extras (2026-10-02)

| # | Decisión | Por qué |
|---|---|---|
| 34 | Campos por lista = **ocultar / renombrar** los de fábrica + **campos propios** (texto o número) | Cubre vinilos, figuritas, etc. sin un editor complejo. Nombre, foto y tengo/falta son fijos. |
| 35 | Renombrar es solo la etiqueta: "Año" se sigue validando como año | Así ordenar, el import y la planilla no cambian según cómo se llame. |
| 36 | Las sugerencias de camisetas (Titular, XL…) solo si el campo conserva su nombre de fábrica; las de lo ya usado son **por lista** | En "Vinilos · Edición" no tiene sentido sugerir "Suplente". |
| 37 | Quitar un campo propio **no borra** los valores cargados | Si vuelve (p. ej. con un import), los datos reaparecen. |
| 38 | El import **suma** los campos propios que trae el archivo, aunque la lista local sea más nueva | Si no, los valores de esos campos quedarían invisibles. |
| 39 | Precio en formato argentino: "25.000" = veinticinco mil, coma decimal | Es como lo escribís. En la planilla va con coma decimal para Excel. |
| 40 | Duplicar copia datos y foto, y el formulario pasa a "Copia" | Lo típico es otra versión de la misma camiseta: solo cambiás la versión. |
| 41 | Compartir como texto: nombre + año/versión/tamaño (lo visible), sin precio, lugar ni descripción | Es para mostrarle a otro qué buscás; el precio es tuyo. En web, si no hay share, se copia al portapapeles. |
| 42 | Migración 3: columnas `fields` (listas) y `price`, `place`, `extra` (ítems) | Probada en Android sobre datos de la versión anterior. |

## Extras 2 (2026-10-05)

| # | Decisión | Por qué |
|---|---|---|
| 43 | Los campos propios se ordenan arrastrando; ese orden manda en el formulario, la línea de info y el menú de orden | Un solo orden para todo, sin otra pantalla. |
| 44 | Compartir pregunta "Como texto / Como imagen (con fotos)" en vez de sumar dos opciones más al menú | El menú de la lista queda corto. |
| 45 | La imagen es siempre en claro, como la lista de la app: foto, nombre y año · versión · tamaño | Se ve en el teléfono de otro; mismos datos que el texto. |
| 46 | Más de 40 ítems = varias imágenes ("1 de 3") | Una imagen muy larga WhatsApp la comprime hasta que no se lee. |
| 47 | La imagen se arma con un canvas usando las miniaturas (no las fotos grandes) | Rápido y liviano: ~50 KB con 5 ítems, ~350 KB con 40. |

## Ícono (2026-10-05)

| # | Decisión | Por qué |
|---|---|---|
| 48 | Ícono: camiseta blanca con un tilde ("la tengo") sobre el verde de la app | Se entiende de un vistazo y no es de ningún club. |
| 49 | Mismo generador que Recos: SVG en `scripts/assets/art.mjs` + `sharp` (`npm run assets`) | Una sola fuente; genera ícono adaptativo, temático (Android 13+), legacy, splash e ícono de Play (`assets/store/icon-512.png`). |
| 50 | Splash con el ícono sobre el fondo de la app (claro/oscuro) | Antes el arranque en frío mostraba una pantalla vacía. |

## Carga inicial (2026-10-05)

| # | Decisión | Por qué |
|---|---|---|
| 51 | El import empareja por nombre + año + versión solo contra lo que **ya había** en el teléfono, y cada ítem local una sola vez | Antes, dos camisetas iguales del mismo archivo (p. ej. dos talles) se fundían en una y se perdía la segunda. |
| 52 | Carga inicial desde fotos: un backup JSON armado fuera de la app (`carga-inicial/`, fuera de git), con las fotos recortadas a la camiseta y lo dudoso marcado "⚠ revisar" | Reusa el import que ya existe; no hace falta código nuevo. Buscando "revisar" aparecen todas las dudosas. |

## Original o réplica (2026-10-06)

| # | Decisión | Por qué |
|---|---|---|
| 53 | "Original o réplica" es un campo fijo (`authenticity`: `original` / `replica` / sin dato), no un campo propio | Los campos propios son texto o número libre; acá hay dos opciones fijas, y como campo fijo se puede ocultar o renombrar en listas donde no aplique. Migración 4 suma la columna. |
| 54 | En el formulario son dos botones; tocar el marcado lo desmarca | "No sé" también es válido, y no hace falta un tercer botón. |
| 55 | La línea de info muestra solo "Réplica" | Lo original es lo esperable: repetir "Original" en cada fila es ruido. Se puede buscar "réplica"/"original" y ordenar por el campo. No va en lo que se comparte. |

## Personalización (2026-10-08)

| # | Decisión | Por qué |
|---|---|---|
| 56 | "Personalización" es un campo fijo de texto libre (`customization`), con atajos Dorsal / Parche / Firmada | Dorsal, parches y firma se combinan de mil formas ("10 Riquelme · parche Libertadores · firmada"): un texto con atajos es más simple que tres campos. Migración 5 (la 4 ya pudo haberse instalado). |
| 57 | Los atajos se suman al final con " · "; Dorsal y Parche dejan el foco para completar, Firmada aparece una sola vez | Dorsales y parches pueden ser varios; la firma no. |
| 58 | Se muestra en la línea de info y **sí** va en lo que se comparte; no se ordena por este campo | En "me falta" importa cuál camiseta es ("la 10 de Riquelme"). Un texto libre no tiene orden útil. |

## Ícono de lista y mover ítems (2026-10-23)

| # | Decisión | Por qué |
|---|---|---|
| 59 | Ícono de lista: 24 emojis a mano + "Otro" para escribir o pegar cualquier emoji del teclado | Una grilla fija nunca alcanza; el teclado del teléfono ya tiene todos. Se valida que sea **un solo** emoji (banderas y tonos de piel incluidos). Sin fotos como ícono: más peso y más pantallas por poco. |
| 60 | Mover ítems con un modo "elegir varios": mantener apretado un ítem, o ⋮ → "Mover a otra lista" | Lo típico es partir una lista (p. ej. sacar las de Boca de Camisetas): de a uno sería eterno. Con la búsqueda + "Todos" se eligen en dos toques. |
| 61 | Destino: otra lista o "＋ Lista nueva", que copia el ícono y los campos de la lista de origen | Partir una lista en dos no debería obligar a configurarla de nuevo. |
| 62 | Los campos propios con datos viajan: si el destino tiene uno con el mismo nombre y tipo, el dato pasa a ese; si no, el campo se suma al destino | Si no, el dato quedaría guardado pero invisible. Misma idea que el import (#51). |
| 63 | Mover se puede deshacer (vuelven los ítems y los campos que tenía el destino); la foto no se toca | La foto está guardada por id de ítem, no por lista. |

## Publicación (2026-10-23)

| # | Decisión | Por qué |
|---|---|---|
| 64 | `appId` definitivo: **`com.coleccionables.app`** (antes `com.fedev84.coleccion`, provisorio) | Elegido por Fede, alineado con el nombre del repo. Ya no se cambia: Play lo ata a la ficha, y cambiarlo instala otra app con la base vacía. |
| 65 | Versión 1.1.0 (versionCode 2) | Primera que va a Play. |
| 66 | Nombre: **Coleccionables** (antes "Colección") | Coincide con el `appId` y el repo, y se encuentra mejor en Play que "Colección", muy genérico. El formato del backup sigue diciendo `"app": "coleccion"` para que los archivos viejos se sigan importando. |
| 67 | Página pública y política de privacidad en **GitHub Pages**, desde `docs/` del mismo repo | El repo ya es público; es gratis y la página sale del mismo código. URL: `https://fedev84.github.io/coleccionables/privacidad/`. |
| 68 | Textos y respuestas de Play Console en `assets/store/FICHA.md` | Un solo lugar para lo que se carga en la consola; tiene que decir lo mismo que la política de privacidad. |
