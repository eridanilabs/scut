import Database, { type Database as DatabaseType } from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const dbPath = process.env.SCUT_DB_PATH ?? './scut.db';
const db: DatabaseType = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schemaPath = path.resolve(new URL('../db/schema.sql', import.meta.url).pathname);
const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
db.exec(schemaSql);

export default db;
