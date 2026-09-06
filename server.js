const express = require('express');
const path = require('path');
const { db } = require('./src/db');
const { betaReports } = require('./src/db/schema');
const { eq, and, isNotNull } = require('drizzle-orm');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Read ADMIN_PASSWORD strictly from environment variable, fallback to default for dev/test
const ADMIN_PASSWORD = (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim()) || 'vanta-admin-2026';

function verifyAdminPassword(inputPassword) {
  if (typeof inputPassword !== 'string' || !inputPassword || inputPassword.trim() === '') {
    return false;
  }
  return inputPassword.trim() === ADMIN_PASSWORD;
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'landing-page')));

// Page routes with directory fallback support
app.get(['/beta-sign', '/beta-sign/'], (req, res) => {
  res.sendFile(path.join(__dirname, 'landing-page', 'beta-sign.html'));
});

app.get(['/beta-testers', '/beta-testers/'], (req, res) => {
  res.sendFile(path.join(__dirname, 'landing-page', 'beta-testers.html'));
});

app.get(['/admin/beta-reports', '/admin/beta-reports/', '/admin/beta-reports.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'landing-page', 'admin-beta-reports.html'));
});

// API: Validate pending unsigned report by ID for /beta-sign
app.get('/api/beta-reports/pending/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'Missing report ID' });

    const rows = await db.select().from(betaReports).where(eq(betaReports.id, id));
    if (rows.length === 0) {
      return res.status(404).json({ error: 'This signing link isn\'t active' });
    }

    const report = rows[0];
    if (report.signature || report.public_key) {
      return res.status(400).json({ error: 'This signing link isn\'t active' });
    }

    return res.json({
      id: report.id,
      tester_handle: report.tester_handle,
      report_text: report.report_text
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// API: Submit client-side signature for a pending report
app.post('/api/beta-reports/sign', async (req, res) => {
  try {
    const { id, public_key, signature, date_signed } = req.body || {};

    if (!id || !public_key || !signature) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const rows = await db.select().from(betaReports).where(eq(betaReports.id, id));
    if (rows.length === 0) {
      return res.status(404).json({ error: 'This signing link isn\'t active' });
    }

    const report = rows[0];
    if (report.signature || report.public_key) {
      return res.status(400).json({ error: 'This signing link isn\'t active' });
    }

    const dateStr = date_signed || new Date().toISOString().slice(0, 10);

    await db.update(betaReports)
      .set({ public_key, signature, date_signed: dateStr })
      .where(eq(betaReports.id, id));

    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// API: Get featured reports (only signed and featured = true)
app.get('/api/beta-reports/featured', async (req, res) => {
  try {
    const reports = await db.select()
      .from(betaReports)
      .where(and(eq(betaReports.featured, true), isNotNull(betaReports.signature)));
    return res.json(reports || []);
  } catch (err) {
    console.error('Error fetching featured reports:', err);
    return res.json([]);
  }
});

// API: Admin Auth Check (Gated strictly)
app.post('/api/admin/verify', (req, res) => {
  const { password } = req.body || {};
  if (verifyAdminPassword(password)) {
    return res.json({ success: true });
  }
  return res.status(401).json({ error: 'Unauthorized: Invalid admin password' });
});

// API: Admin create pending signing link
app.post('/api/admin/create-pending-report', async (req, res) => {
  const { password, tester_handle, report_text } = req.body || {};
  if (!verifyAdminPassword(password)) {
    return res.status(401).json({ error: 'Unauthorized: Invalid admin password' });
  }

  if (!tester_handle || !report_text) {
    return res.status(400).json({ error: 'Missing tester_handle or report_text' });
  }

  try {
    const id = 'br_' + crypto.randomBytes(8).toString('hex');
    await db.insert(betaReports).values({
      id,
      tester_handle: tester_handle.trim(),
      report_text: report_text.trim(),
      public_key: null,
      signature: null,
      date_signed: null,
      featured: false
    });

    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol || 'http';
    const link = `${protocol}://${host}/beta-sign?id=${id}`;

    return res.json({ success: true, id, link });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// API: Admin list all reports
app.post('/api/admin/beta-reports', async (req, res) => {
  const { password } = req.body || {};
  if (!verifyAdminPassword(password)) {
    return res.status(401).json({ error: 'Unauthorized: Invalid admin password' });
  }

  try {
    const reports = await db.select().from(betaReports);
    return res.json(reports || []);
  } catch (err) {
    console.error('Error fetching all reports:', err);
    return res.json([]);
  }
});

// API: Admin toggle featured
app.post('/api/admin/toggle-featured', async (req, res) => {
  const { password, id, featured } = req.body || {};
  if (!verifyAdminPassword(password)) {
    return res.status(401).json({ error: 'Unauthorized: Invalid admin password' });
  }

  try {
    await db.update(betaReports).set({ featured }).where(eq(betaReports.id, id));
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`VantaLock Web Server running on port ${PORT}`);
  });
}

module.exports = app;
