import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  // Provisorio: confirmar antes de registrar la app en Play Console (después no se cambia).
  appId: 'com.coleccionables.app',
  appName: 'Coleccionables',
  webDir: 'dist',
  plugins: {
    CapacitorSQLite: { androidIsEncryption: false },
    Keyboard: { resize: 'ionic' },
  },
}

export default config
