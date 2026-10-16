# Instrucciones para trabajar en Colección

Para cualquier asistente de IA (Claude, Codex, Cursor, etc.) o persona que tome el proyecto. Leé esto, [PLAN.md](PLAN.md) y [DECISIONES.md](DECISIONES.md) antes de tocar código.

## Cómo trabajar con Fede

- **Respuestas cortas y en castellano rioplatense (voseo).** Textos largos le cuestan: lo justo, en listas breves.
- Describe el dominio en detalle pero **delega las decisiones técnicas**: recomendá una opción, no le pidas que elija entre stacks.
- A veces quiere algo **pensado pero no construido** (dejarlo previsto en datos o en "Ideas para después"). Si no está claro, preguntá antes de implementar de más.
- Quiere la app **liviana y funcional**: sin anuncios, sin fuentes extra, sin animaciones de adorno.
- **No hacer commit ni push sin que lo pida.** Puede haber varias sesiones abiertas a la vez sobre el repo: releé un archivo antes de editarlo.
- Las "Ideas para después" de PLAN.md no se hacen salvo que las pida.

## Al terminar un cambio

1. `npm test` y `npm run typecheck` pasan.
2. Probalo de verdad (browser con `npm run dev`, o emulador/teléfono si es nativo: cámara, compartir, archivos).
3. **Actualizá PLAN.md** (qué se hizo, con fecha) y **sumá las decisiones a DECISIONES.md** (numeración correlativa, una fila por decisión, con el porqué).
4. Si cambia el modelo de datos, actualizá la tabla "Modelo de datos" de PLAN.md.

## Convenciones del código

- Capas: `views/` + `components/` → `stores/` (Pinia) → `services/` → `data/ports.ts`; la implementación SQLite está en `data/sqlite/` y se cablea solo en `app/container.ts`.
- `domain/` es puro (sin Vue ni SQLite) y tiene los tests. Lógica nueva va ahí, con test.
- **Todos los textos de la UI en `src/copy/es.ts`**, con voseo ("Probá de nuevo", "Tocá…").
- **Migraciones append-only** en `data/sqlite/migrations.ts`: una ya publicada no se edita, se agrega otra.
- Un campo nuevo de ítem toca: `domain/models.ts`, `domain/fields.ts` (si es campo fijo), `validation.ts`, `backup.ts` (parse tolerante), `csv.ts`, `itemLine.ts`, `query.ts` (búsqueda/orden), el repositorio SQLite + migración, `ItemFormSheet.vue` y los tests.
- El backup JSON es el formato de intercambio: el parse tiene que tolerar archivos viejos o escritos a mano (lo inválido se descarta, no frena el import).
- Comentarios cortos en castellano, explicando el porqué.

## Trampas conocidas

- **Android necesita JDK 21** (`JAVA_HOME=/opt/homebrew/opt/openjdk@21`); con otro JDK Gradle falla.
- `sql.js` 1.11.0 y TypeScript 6 están fijos a propósito (ver DECISIONES #4).
- En un navegador headless o una pestaña oculta, `jeep-sqlite` (SQLite web) puede quedar colgado al cargar hasta que la página pinta un frame. No es un bug de la app; en Android se usa SQLite nativo.
- `appId` `com.fedev84.coleccion` es provisorio: confirmarlo antes de registrar la app en Play.
- `carga-inicial/` está fuera de git porque tiene fotos personales: no lo subas.
