import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

/** Íconos de la barra de estado según el tema, también si cambia con la app abierta. */
export async function syncStatusBar() {
  if (!Capacitor.isNativePlatform()) return
  const scheme = matchMedia('(prefers-color-scheme: dark)')
  const apply = () => StatusBar.setStyle({ style: scheme.matches ? Style.Dark : Style.Light }).catch(() => {})
  scheme.addEventListener('change', apply)
  await apply()
}
