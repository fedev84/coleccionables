import { Capacitor } from '@capacitor/core'
import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite'
import { MIGRATIONS } from './migrations'

type Row = Record<string, unknown>
export interface Statement { sql: string; values?: unknown[] }

/**
 * Wrapper fino sobre @capacitor-community/sqlite.
 * - Corre migraciones propias con PRAGMA user_version (portables web/nativo).
 * - En web persiste en IndexedDB (jeep-sqlite) después de cada escritura.
 */
export class SqliteDb {
  private constructor(
    private sqlite: SQLiteConnection,
    private conn: SQLiteDBConnection,
    private name: string,
  ) {}

  static async open(name: string): Promise<SqliteDb> {
    const sqlite = new SQLiteConnection(CapacitorSQLite)
    if (Capacitor.getPlatform() === 'web') await initWebStore(sqlite)

    await sqlite.checkConnectionsConsistency()
    const exists = (await sqlite.isConnection(name, false)).result
    const conn = exists
      ? await sqlite.retrieveConnection(name, false)
      : await sqlite.createConnection(name, false, 'no-encryption', 1, false)
    await conn.open()

    const db = new SqliteDb(sqlite, conn, name)
    await db.migrate()
    return db
  }

  async query<T = Row>(sql: string, values: unknown[] = []): Promise<T[]> {
    const res = await this.conn.query(sql, values)
    return (res.values ?? []) as T[]
  }

  async run(sql: string, values: unknown[] = []): Promise<void> {
    await this.conn.run(sql, values, false)
    await this.persist()
  }

  /** Varias escrituras atómicas. */
  async batch(statements: Statement[]): Promise<void> {
    if (!statements.length) return
    await this.conn.executeSet(
      statements.map((s) => ({ statement: s.sql, values: s.values ?? [] })),
      true,
    )
    await this.persist()
  }

  private async migrate() {
    const [{ user_version: current }] = await this.query<{ user_version: number }>('PRAGMA user_version')
    for (const m of MIGRATIONS.filter((m) => m.version > current)) {
      await this.conn.execute(`${m.sql}\nPRAGMA user_version = ${m.version};`, true)
    }
    await this.persist()
  }

  private async persist() {
    if (Capacitor.getPlatform() === 'web') await this.sqlite.saveToStore(this.name)
  }
}

async function initWebStore(sqlite: SQLiteConnection) {
  const { defineCustomElements } = await import('jeep-sqlite/loader')
  await defineCustomElements(window)
  if (!document.querySelector('jeep-sqlite')) {
    const el = document.createElement('jeep-sqlite')
    el.setAttribute('autoSave', 'true')
    document.body.appendChild(el)
  }
  await customElements.whenDefined('jeep-sqlite')
  await sqlite.initWebStore()
}
