const { sqliteTable, text, integer } = require('drizzle-orm/sqlite-core');

const betaReports = sqliteTable('beta_reports', {
  id: text('id').primaryKey(),
  tester_handle: text('tester_handle').notNull(),
  report_text: text('report_text').notNull(),
  public_key: text('public_key'),
  signature: text('signature'),
  date_signed: text('date_signed'),
  featured: integer('featured', { mode: 'boolean' }).notNull().default(false),
});

const decoyPasswords = sqliteTable('decoy_passwords', {
  id: text('id').primaryKey(),
  password_hash: text('password_hash').notNull(),
  created_at: text('created_at').notNull(),
});

const decoyVaultData = sqliteTable('decoy_vault_data', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  category: text('category').notNull(), // 'Financial' | 'Legal' | 'Personal'
  username: text('username'),
  password: text('password'),
  url: text('url'),
  notes: text('notes'),
  created_at: text('created_at').notNull(),
});

module.exports = { betaReports, decoyPasswords, decoyVaultData };
