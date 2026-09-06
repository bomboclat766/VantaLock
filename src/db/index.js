const { createClient } = require('@libsql/client');
const { drizzle } = require('drizzle-orm/libsql');
const schema = require('./schema');

const url = process.env.TURSO_DATABASE_URL || 'file:local.db';
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

const client = createClient({
  url,
  authToken,
});

// Auto-migrate / create table if sqlite local file
if (url.startsWith('file:')) {
  client.execute(`
    CREATE TABLE IF NOT EXISTS beta_reports (
      id TEXT PRIMARY KEY,
      tester_handle TEXT NOT NULL,
      report_text TEXT NOT NULL,
      public_key TEXT NOT NULL,
      signature TEXT NOT NULL,
      date_signed TEXT NOT NULL,
      featured INTEGER NOT NULL DEFAULT 0
    );
  `).catch(err => console.error('Migration error:', err));
}

const db = drizzle(client, { schema });

module.exports = { db };
