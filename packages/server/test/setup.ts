// Test setup: must execute BEFORE any module that imports './src/db/db.js'.
// We point the SQLite database at a fresh file inside .test-data/ and set
// the callback secret that routes/internal.ts requires at module load.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, '..', '.test-data');
fs.mkdirSync(dataDir, { recursive: true });

const dbFile = path.join(dataDir, `traces-${process.pid}-${Date.now()}.db`);
for (const ext of ['', '-wal', '-shm']) {
  try {
    fs.unlinkSync(dbFile + ext);
  } catch {
    /* ignore */
  }
}

process.env.SCUT_DB_PATH = dbFile;
process.env.SCUT_CALLBACK_SECRET = process.env.SCUT_CALLBACK_SECRET ?? 'test-secret';

// Export the path so afterAll-style cleanup can remove it.
export const TEST_DB_PATH = dbFile;
