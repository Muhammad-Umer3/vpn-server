import * as fs from 'fs';
import * as path from 'path';
import { pool } from './pool';
import { logger } from '../logger';

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'db', 'migrations');

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const applied = await client.query('SELECT name FROM _migrations');
    const appliedSet = new Set(applied.rows.map((r) => r.name));

    let files: string[];
    try {
      files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
    } catch {
      logger.warn('Migrations directory not found, skipping');
      return;
    }

    files.sort();

    for (const file of files) {
      const name = file;
      if (appliedSet.has(name)) continue;

      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [name]);
        logger.info({ migration: name }, 'Migration applied');
      } catch (err) {
        logger.error({ err, migration: name }, 'Migration failed');
        throw err;
      }
    }
  } finally {
    client.release();
  }
}
