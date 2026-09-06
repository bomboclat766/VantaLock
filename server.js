const express = require('express');
const path = require('path');
const { db } = require('./src/db');
const { betaReports } = require('./src/db/schema');
const { eq } = require('drizzle-orm');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'vanta-admin-2026';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'landing-page')));

// Page routes
app.get('/beta-sign', (req, res) => {
  res.sendFile(path.join(__dirname, 'landing-page', 'beta-sign.html'));
});

app.get('/beta-testers', (req, res) => {
  res.sendFile(path.join(__dirname, 'landing-page', 'beta-testers.html'));
});

app.get('/admin/beta-reports', (req, res) => {
  res.sendFile(path.join(__dirname, 'landing-page', 'admin-beta-reports.html'));
});

// API Endpoint: Submit beta report
app.post('/api/beta-reports', async (req, res) => {
  try {
    const { tester_handle, report_text, public_key, signature, date_signed } = req.body;

    if (!tester_handle || !report_text || !public_key || !signature) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const id = 'br_' + crypto.randomBytes(8).toString('hex');
    const dateStr = date_signed || new Date().toISOString();

    await db.insert(betaReports).values({
      id,
      tester_handle,
      report_text,
      public_key,
      signature,
      date_signed: dateStr,
      featured: false,
    });

    return res.json({ success: true, id });
  } catch (err) {
    console.error('Error inserting report:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// API Endpoint: Get featured reports
app.get('/api/beta-reports/featured', async (req, res) => {
  try {
    const reports = await db.select().from(betaReports).where(eq(betaReports.featured, true));
    return res.json(reports);
  } catch (err) {
    console.error('Error fetching featured reports:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// API Endpoint: Admin Auth Check
app.post('/api/admin/verify', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    return res.json({ success: true });
  }
  return res.status(401).json({ error: 'Unauthorized' });
});

// API Endpoint: Admin list all reports
app.post('/api/admin/beta-reports', async (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const reports = await db.select().from(betaReports);
    return res.json(reports);
  } catch (err) {
    console.error('Error fetching all reports:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// API Endpoint: Admin toggle featured
app.post('/api/admin/toggle-featured', async (req, res) => {
  const { password, id, featured } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await db.update(betaReports).set({ featured }).where(eq(betaReports.id, id));
    return res.json({ success: true });
  } catch (err) {
    console.error('Error toggling featured:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`VantaLock Web Server running on port ${PORT}`);
  });
}

module.exports = app;
