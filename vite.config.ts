import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // jeep-sqlite (web) trae chunks lazy de Stencil; Vite los sirve tal cual.
  optimizeDeps: { exclude: ['jeep-sqlite'] },
  // android/ cambia al compilar la app nativa: que no recargue el navegador.
  server: { port: 5180, watch: { ignored: ['**/android/**'] } },
})
