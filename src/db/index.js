const { createClient } = require('@libsql/client');
const { drizzle } = require('drizzle-orm/libsql');
const schema = require('./schema');

const url = process.env.TURSO_DATABASE_URL || 'file:local.db';
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

const client = createClient({
  url,
  authToken,
});

if (url.startsWith('file:')) {
  client.execute(`
    CREATE TABLE IF NOT EXISTS beta_reports (
      id TEXT PRIMARY KEY,
      tester_handle TEXT NOT NULL,
      report_text TEXT NOT NULL,
      public_key TEXT,
      signature TEXT,
      date_signed TEXT,
      featured INTEGER NOT NULL DEFAULT 0
    );
  `).catch(err => console.error('Migration error:', err));

  client.execute(`
    CREATE TABLE IF NOT EXISTS decoy_passwords (
      id TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `).catch(err => console.error('Migration error decoy_passwords:', err));

  client.execute(`
    CREATE TABLE IF NOT EXISTS decoy_vault_data (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      username TEXT,
      password TEXT,
      url TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );
  `).catch(err => console.error('Migration error decoy_vault_data:', err));
}

const db = drizzle(client, { schema });

module.exports = { db };
