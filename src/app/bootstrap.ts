import { createContainer } from './container'
import { useListsStore } from '@/stores/lists'
import { syncStatusBar } from '@/platform/statusBar'

/** Arranque: base de datos → listas → UI nativa. */
export async function bootstrap() {
  await createContainer()
  await useListsStore().load()
  await syncStatusBar()
}
