import type { CollectionRepository } from '@/data/ports'
import type { Collection, CollectionWithCounts, Id } from '@/domain/models'
import { isDefaultConfig, parseFields, type FieldConfig } from '@/domain/fields'
import type { SqliteDb } from './SqliteDb'

interface Row {
  id: string; name: string; emoji: string; fields: string | null; sort_order: number; created_at: string; updated_at: string
  have?: number; want?: number
}

const toCollection = (r: Row): Collection => ({
  id: r.id,
  name: r.name,
  emoji: r.emoji,
  fields: parseFields(r.fields),
  sortOrder: r.sort_order,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

const COLUMNS: Record<keyof Collection, string> = {
  id: 'id', name: 'name', emoji: 'emoji', fields: 'fields', sortOrder: 'sort_order', createdAt: 'created_at', updatedAt: 'updated_at',
}

/** La configuración de fábrica se guarda como NULL. */
const fieldsValue = (f: FieldConfig) => (isDefaultConfig(f) ? null : JSON.stringify(f))

const upsertSql = 'INSERT OR REPLACE INTO lists (id, name, emoji, fields, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
const upsertValues = (c: Collection) => [c.id, c.name, c.emoji, fieldsValue(c.fields), c.sortOrder, c.createdAt, c.updatedAt]

export class SqliteCollectionRepository implements CollectionRepository {
  constructor(private db: SqliteDb) {}

  async all(): Promise<CollectionWithCounts[]> {
    const rows = await this.db.query<Row>(`
      SELECT l.*,
        COALESCE(SUM(CASE WHEN i.status = 'have' THEN 1 ELSE 0 END), 0) AS have,
        COALESCE(SUM(CASE WHEN i.status = 'want' THEN 1 ELSE 0 END), 0) AS want
      FROM lists l LEFT JOIN items i ON i.list_id = l.id
      GROUP BY l.id
      ORDER BY l.sort_order, l.created_at`)
    return rows.map((r) => ({ ...toCollection(r), have: r.have ?? 0, want: r.want ?? 0 }))
  }

  async get(id: Id) {
    const [row] = await this.db.query<Row>('SELECT * FROM lists WHERE id = ?', [id])
    return row ? toCollection(row) : null
  }

  async maxSortOrder() {
    const [r] = await this.db.query<{ m: number | null }>('SELECT MAX(sort_order) AS m FROM lists')
    return r?.m ?? -1
  }

  insert(c: Collection) {
    return this.db.run(upsertSql, upsertValues(c))
  }

  upsertMany(lists: Collection[]) {
    return this.db.batch(lists.map((c) => ({ sql: upsertSql, values: upsertValues(c) })))
  }

  async update(id: Id, patch: Partial<Collection>) {
    const entries = Object.entries(patch).filter(([k]) => k !== 'id') as [keyof Collection, unknown][]
    if (!entries.length) return
    const set = entries.map(([k]) => `${COLUMNS[k]} = ?`).join(', ')
    const value = (k: keyof Collection, v: unknown) => (k === 'fields' ? fieldsValue(v as FieldConfig) : v)
    await this.db.run(`UPDATE lists SET ${set} WHERE id = ?`, [...entries.map(([k, v]) => value(k, v)), id])
  }

  reorder(ids: Id[]) {
    return this.db.batch(ids.map((id, i) => ({ sql: 'UPDATE lists SET sort_order = ? WHERE id = ?', values: [i, id] })))
  }

  remove(id: Id) {
    return this.db.batch([
      { sql: 'DELETE FROM photos WHERE item_id IN (SELECT id FROM items WHERE list_id = ?)', values: [id] },
      { sql: 'DELETE FROM items WHERE list_id = ?', values: [id] },
      { sql: 'DELETE FROM lists WHERE id = ?', values: [id] },
    ])
  }
}
