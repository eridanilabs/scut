import type { Database } from 'better-sqlite3';

export interface Migration {
  version: number;        // monotonic, applied in ascending order (gaps allowed)
  name: string;           // kebab-case
  up: (db: Database) => void;
}

/**
 * Apply any migrations from `migrations` that have not yet been recorded
 * in the `schema_migrations` table. Each migration runs inside a
 * transaction; on failure, the failed migration is not recorded and the
 * error is re-thrown.
 */
export function runMigrations(db: Database, migrations: Migration[]): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       version    INTEGER PRIMARY KEY,
       name       TEXT NOT NULL,
       applied_at TEXT NOT NULL DEFAULT (datetime('now'))
     )`
  );

  const applied = new Set<number>(
    (db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[])
      .map((row) => row.version)
  );

  const ordered = [...migrations].sort((a, b) => a.version - b.version);

  for (const migration of ordered) {
    if (applied.has(migration.version)) continue;

    const insert = db.prepare(
      'INSERT INTO schema_migrations (version, name) VALUES (?, ?)'
    );

    const tx = db.transaction(() => {
      migration.up(db);
      insert.run(migration.version, migration.name);
    });

    tx();
  }
}
