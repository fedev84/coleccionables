import type { ItemRepository, ItemWrite } from '@/data/ports'
import { MAX_PHOTOS, type Id, type Item } from '@/domain/models'
import { parseAuthenticity, parseStatus } from '@/domain/validation'
import type { SqliteDb, Statement } from './SqliteDb'

interface Row {
  id: string; list_id: string; name: string; status: string; year: number | null
  version: string | null; size: string | null; url: string | null; description: string | null
  price: number | null; place: string | null; extra: string | null; authenticity: string | null; customization: string | null
  gone_at: string | null; gone_reason: string | null
  thumb: string | null; created_at: string; updated_at: string
}

function parseExtra(raw: string | null): Item['extra'] {
  try {
    const v = JSON.parse(raw ?? '{}')
    return v && typeof v === 'object' ? v : {}
  } catch {
    return {}
  }
}

const toItem = (r: Row): Item => ({
  id: r.id,
  listId: r.list_id,
  name: r.name,
  status: parseStatus(r.status),
  year: r.year ?? null,
  version: r.version,
  size: r.size,
  authenticity: parseAuthenticity(r.authenticity),
  customization: r.customization ?? null,
  url: r.url,
  description: r.description,
  price: r.price ?? null,
  place: r.place,
  extra: parseExtra(r.extra),
  goneAt: r.gone_at ?? null,
  goneReason: r.gone_reason ?? null,
  thumb: r.thumb,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

const upsert = (i: Item): Statement => ({
  sql: `INSERT OR REPLACE INTO items
    (id, list_id, name, status, year, version, size, url, description, price, place, extra, authenticity, customization, gone_at, gone_reason, thumb, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  values: [
    i.id, i.listId, i.name, i.status, i.year, i.version, i.size, i.url, i.description,
    i.price, i.place, Object.keys(i.extra).length ? JSON.stringify(i.extra) : null, i.authenticity, i.customization, i.goneAt, i.goneReason, i.thumb, i.createdAt, i.updatedAt,
  ],
})

export class SqliteItemRepository implements ItemRepository {
  constructor(private db: SqliteDb) {}

  async all() {
    return (await this.db.query<Row>('SELECT * FROM items ORDER BY name COLLATE NOCASE')).map(toItem)
  }

  async byList(listId: Id) {
    const rows = await this.db.query<Row>('SELECT * FROM items WHERE list_id = ? ORDER BY name COLLATE NOCASE', [listId])
    return rows.map(toItem)
  }

  async get(id: Id) {
    const [row] = await this.db.query<Row>('SELECT * FROM items WHERE id = ?', [id])
    return row ? toItem(row) : null
  }

  save(item: Item, photos?: string[]) {
    return this.saveMany([{ item, photos }])
  }

  saveMany(writes: ItemWrite[]) {
    return this.db.batch(writes.flatMap(({ item, photos }) => {
      const statements = [upsert(item)]
      // Las fotos se reemplazan todas juntas: así el orden queda siempre 0, 1, 2…
      if (photos !== undefined) {
        statements.push({ sql: 'DELETE FROM item_photos WHERE item_id = ?', values: [item.id] })
        photos.slice(0, MAX_PHOTOS).forEach((data, position) =>
          statements.push({ sql: 'INSERT INTO item_photos (item_id, position, data) VALUES (?, ?, ?)', values: [item.id, position, data] }))
      }
      return statements
    }))
  }

  async remove(id: Id) {
    await this.db.batch([
      { sql: 'DELETE FROM item_photos WHERE item_id = ?', values: [id] },
      { sql: 'DELETE FROM items WHERE id = ?', values: [id] },
    ])
    await this.db.flushJournal()
  }

  async photos(id: Id) {
    const rows = await this.db.query<{ data: string }>('SELECT data FROM item_photos WHERE item_id = ? ORDER BY position', [id])
    return rows.map((r) => r.data)
  }

  async allPhotos() {
    const rows = await this.db.query<{ item_id: string; data: string }>('SELECT item_id, data FROM item_photos ORDER BY item_id, position')
    const out = new Map<Id, string[]>()
    for (const r of rows) out.set(r.item_id, [...(out.get(r.item_id) ?? []), r.data])
    return out
  }

  async usedValues(field: 'version' | 'size' | 'place', listId: Id) {
    // `field` viene tipado, no del usuario: es seguro interpolarlo.
    const rows = await this.db.query<{ v: string }>(`
      SELECT ${field} AS v FROM items
      WHERE list_id = ? AND ${field} IS NOT NULL AND ${field} <> ''
      GROUP BY ${field} COLLATE NOCASE
      ORDER BY COUNT(*) DESC, MAX(updated_at) DESC`, [listId])
    return rows.map((r) => r.v)
  }

  async usedNames(listId: Id) {
    const rows = await this.db.query<{ v: string }>(`
      SELECT name AS v FROM items
      GROUP BY name COLLATE NOCASE
      ORDER BY SUM(list_id = ?) DESC, COUNT(*) DESC, MAX(updated_at) DESC`, [listId])
    return rows.map((r) => r.v)
  }
}
