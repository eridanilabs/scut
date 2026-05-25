import Database, { type Database as DatabaseType } from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { runMigrations } from './migrate.js';
import { migrations } from './migrations/index.js';

const dbPath = process.env.SCUT_DB_PATH ?? './scut.db';
const db: DatabaseType = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Phase 1 bootstrap: ensure base tables exist via schema.sql (idempotent
// CREATE TABLE IF NOT EXISTS). Subsequent additive changes are handled by
// numbered migrations applied in order.
const schemaPath = path.resolve(new URL('../db/schema.sql', import.meta.url).pathname);
const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
db.exec(schemaSql);

runMigrations(db, migrations);

export default db;
