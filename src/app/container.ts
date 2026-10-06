/**
 * Composition root: el único lugar que conoce las implementaciones concretas.
 * Cambiar SQLite por otra fuente = cambiar este archivo.
 */
import { SqliteDb } from '@/data/sqlite/SqliteDb'
import { SqliteCollectionRepository } from '@/data/sqlite/SqliteCollectionRepository'
import { SqliteItemRepository } from '@/data/sqlite/SqliteItemRepository'
import { SqliteMetaRepository } from '@/data/sqlite/SqliteMetaRepository'
import type { MetaRepository } from '@/data/ports'
import { CollectionService } from '@/services/CollectionService'
import { ItemService } from '@/services/ItemService'
import { BackupService } from '@/services/BackupService'

export interface Container {
  lists: CollectionService
  items: ItemService
  backup: BackupService
  meta: MetaRepository
}

let container: Container | null = null

export async function createContainer(): Promise<Container> {
  const db = await SqliteDb.open('coleccion')
  const listRepo = new SqliteCollectionRepository(db)
  const itemRepo = new SqliteItemRepository(db)
  container = {
    lists: new CollectionService(listRepo),
    items: new ItemService(itemRepo),
    backup: new BackupService(listRepo, itemRepo),
    meta: new SqliteMetaRepository(db),
  }
  return container
}

export function services(): Container {
  if (!container) throw new Error('Container no inicializado: llamá createContainer() en el arranque')
  return container
}
