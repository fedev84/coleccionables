import type { ItemRepository, ItemWrite } from '@/data/ports'
import type { Id, Item } from '@/domain/models'
import { parseAuthenticity } from '@/domain/validation'
import type { SqliteDb, Statement } from './SqliteDb'

interface Row {
  id: string; list_id: string; name: string; status: string; year: number | null
  version: string | null; size: string | null; url: string | null; description: string | null
  price: number | null; place: string | null; extra: string | null; authenticity: string | null; customization: string | null
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
  status: r.status === 'want' ? 'want' : 'have',
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
  thumb: r.thumb,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

const upsert = (i: Item): Statement => ({
  sql: `INSERT OR REPLACE INTO items
    (id, list_id, name, status, year, version, size, url, description, price, place, extra, authenticity, customization, thumb, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  values: [
    i.id, i.listId, i.name, i.status, i.year, i.version, i.size, i.url, i.description,
    i.price, i.place, Object.keys(i.extra).length ? JSON.stringify(i.extra) : null, i.authenticity, i.customization, i.thumb, i.createdAt, i.updatedAt,
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

  save(item: Item, photo?: string | null) {
    return this.saveMany([{ item, photo }])
  }

  saveMany(writes: ItemWrite[]) {
    return this.db.batch(writes.flatMap(({ item, photo }) => {
      const statements = [upsert(item)]
      if (photo === null) statements.push({ sql: 'DELETE FROM photos WHERE item_id = ?', values: [item.id] })
      else if (photo !== undefined) {
        statements.push({ sql: 'INSERT OR REPLACE INTO photos (item_id, data) VALUES (?, ?)', values: [item.id, photo] })
      }
      return statements
    }))
  }

  remove(id: Id) {
    return this.db.batch([
      { sql: 'DELETE FROM photos WHERE item_id = ?', values: [id] },
      { sql: 'DELETE FROM items WHERE id = ?', values: [id] },
    ])
  }

  async photo(id: Id) {
    const [r] = await this.db.query<{ data: string }>('SELECT data FROM photos WHERE item_id = ?', [id])
    return r?.data ?? null
  }

  async allPhotos() {
    const rows = await this.db.query<{ item_id: string; data: string }>('SELECT item_id, data FROM photos')
    return new Map(rows.map((r) => [r.item_id, r.data]))
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
}
