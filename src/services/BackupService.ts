import type { CollectionRepository, ItemRepository } from '@/data/ports'
import type { Collection } from '@/domain/models'
import { buildBackup, parseBackup, planImport, serializeBackup, type ImportPlan } from '@/domain/backup'
import { buildCsv } from '@/domain/csv'

export type { ImportPlan }

/** Export/import como texto. Leer/escribir archivos es cosa de platform/files. */
export class BackupService {
  constructor(private lists: CollectionRepository, private items: ItemRepository) {}

  private async localLists(): Promise<Collection[]> {
    return (await this.lists.all()).map(({ have: _h, want: _w, ...l }) => l)
  }

  async exportJson(withPhotos: boolean): Promise<string> {
    const photos = withPhotos ? await this.items.allPhotos() : null
    return serializeBackup(buildBackup(await this.localLists(), await this.items.all(), photos))
  }

  async exportCsv(): Promise<string> {
    return buildCsv(await this.localLists(), await this.items.all())
  }

  /** Analiza el archivo sin tocar nada: sirve para mostrar el resumen antes de confirmar. */
  async previewImport(text: string): Promise<ImportPlan> {
    return planImport(parseBackup(text), await this.localLists(), await this.items.all())
  }

  async applyImport(plan: ImportPlan): Promise<void> {
    // Listas primero: los ítems las referencian.
    await this.lists.upsertMany(plan.lists)
    await this.items.saveMany(plan.items)
  }
}
