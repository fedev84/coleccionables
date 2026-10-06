import type { MetaRepository } from '@/data/ports'
import type { SqliteDb } from './SqliteDb'

export class SqliteMetaRepository implements MetaRepository {
  constructor(private db: SqliteDb) {}

  async get(key: string) {
    const [r] = await this.db.query<{ value: string | null }>('SELECT value FROM meta WHERE key = ?', [key])
    return r?.value ?? null
  }

  set(key: string, value: string) {
    return this.db.run('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', [key, value])
  }
}
