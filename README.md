# Coleccionables

App Android liviana para organizar colecciones (empezando por camisetas de fútbol): listas propias, qué tengo y qué me falta, fotos, buscar, ordenar y compartir. Todo local en SQLite, exportable. Vue 3 + Ionic + Capacitor.

- Qué hace y en qué etapa está: [PLAN.md](PLAN.md)
- Por qué está hecho así: [DECISIONES.md](DECISIONES.md)
- Instrucciones para quien programe (persona o IA): [AGENTS.md](AGENTS.md)

## Comandos

```bash
npm install
npm run dev        # browser en localhost:5180 (SQLite web con jeep-sqlite)
npm test           # tests del dominio (Vitest)
npm run typecheck  # vue-tsc
npm run android    # build + sync + abre Android Studio
npm run assets     # regenera ícono y splash desde scripts/assets/art.mjs
```

APK de debug sin abrir Android Studio (requiere JDK 21):

```bash
npm run build && npx cap sync android
cd android && JAVA_HOME=/opt/homebrew/opt/openjdk@21 ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

En Android Studio: abrir la carpeta `android/`, elegir el teléfono (depuración USB) y ▶ Run.

## Datos

- Todo vive en el teléfono. El backup es un JSON (ícono de carpeta en "Mis listas" → Exportar / importar), con o sin fotos; se importa con merge sin duplicar.
- `carga-inicial/` (fuera de git, fotos personales): `camisetas-carga-inicial.json`, la carga armada a partir de fotos de la colección. Guardá una copia aparte: no está en GitHub.
- Formato del backup: ver `src/domain/backup.ts` (el comentario de arriba tiene un ejemplo mínimo escrito a mano).

## Repo

https://github.com/fedev84/coleccionables (rama `main`).
