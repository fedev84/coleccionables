/**
 * Migraciones append-only. Nunca editar una ya publicada: agregar una nueva.
 * Columnas en snake_case; el mapeo a camelCase vive en cada repositorio.
 */
export const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT
      );
    `,
  },
  {
    version: 2,
    sql: `
      CREATE TABLE IF NOT EXISTS lists (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        emoji TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY NOT NULL,
        list_id TEXT NOT NULL,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'have',
        year INTEGER,
        version TEXT,
        size TEXT,
        url TEXT,
        description TEXT,
        thumb TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_items_list ON items(list_id);
      -- Fotos grandes aparte: la lista solo lee las miniaturas.
      CREATE TABLE IF NOT EXISTS photos (
        item_id TEXT PRIMARY KEY NOT NULL,
        data TEXT NOT NULL
      );
    `,
  },
  {
    version: 3,
    sql: `
      ALTER TABLE lists ADD COLUMN fields TEXT;
      ALTER TABLE items ADD COLUMN price REAL;
      ALTER TABLE items ADD COLUMN place TEXT;
      ALTER TABLE items ADD COLUMN extra TEXT;
    `,
  },
  {
    version: 4,
    sql: `
      ALTER TABLE items ADD COLUMN authenticity TEXT;
    `,
  },
  {
    version: 5,
    sql: `
      ALTER TABLE items ADD COLUMN customization TEXT;
    `,
  },
  {
    // Hasta 5 fotos por ítem: la de posición 0 es la principal (su miniatura es items.thumb).
    version: 6,
    sql: `
      CREATE TABLE IF NOT EXISTS item_photos (
        item_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        data TEXT NOT NULL,
        PRIMARY KEY (item_id, position)
      );
      INSERT OR IGNORE INTO item_photos (item_id, position, data) SELECT item_id, 0, data FROM photos;
      DROP TABLE IF EXISTS photos;
    `,
  },
  {
    // Estado "Tuve": desde cuándo (AAAA-MM-DD) y por qué ya no la tengo.
    version: 7,
    sql: `
      ALTER TABLE items ADD COLUMN gone_at TEXT;
      ALTER TABLE items ADD COLUMN gone_reason TEXT;
    `,
  },
]
