import { describe, expect, it } from 'vitest'
// @ts-expect-error sql.js no trae tipos y solo se usa en este test.
import initSqlJs from 'sql.js'
import { MIGRATIONS } from './migrations'

describe('migración 6 (varias fotos)', () => {
  it('pasa la foto que ya había a la posición 0 y saca la tabla vieja', async () => {
    const SQL = await initSqlJs()
    const db = new SQL.Database()
    for (const m of MIGRATIONS.filter((m) => m.version <= 5)) db.exec(m.sql)
    db.exec(`INSERT INTO photos (item_id, data) VALUES ('I1', 'data:image/jpeg;base64,F')`)
    for (const m of MIGRATIONS.filter((m) => m.version > 5)) db.exec(m.sql)
    expect(db.exec('SELECT item_id, position, data FROM item_photos')[0].values).toEqual([['I1', 0, 'data:image/jpeg;base64,F']])
    expect(db.exec(`SELECT name FROM sqlite_master WHERE name = 'photos'`)).toEqual([])
  })
})
