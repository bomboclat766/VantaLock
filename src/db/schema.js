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

module.exports = { betaReports };
