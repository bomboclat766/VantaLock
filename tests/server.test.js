const request = require('supertest');
const app = require('../server');

describe('Server & Beta Reports Endpoints with Admin Link Creation', () => {
  let adminPass = 'vanta-admin-2026';
  let createdReportId = '';
  let generatedSigningLink = '';

  test('GET /beta-sign without id should return invalid/expired message in HTML', async () => {
    const res = await request(app).get('/beta-sign/');
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain('This link is invalid or has expired');
  });

  test('Admin creates a pending signing link', async () => {
    const res = await request(app).post('/api/admin/create-pending-report').send({
      password: adminPass,
      tester_handle: '@auditor_bob',
      report_text: 'VantaLock local encryption verified.'
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.id).toBeDefined();
    expect(res.body.link).toContain('/beta-sign?id=');
    createdReportId = res.body.id;
    generatedSigningLink = res.body.link;
  });

  test('Fetch pending report details by ID', async () => {
    const res = await request(app).get(`/api/beta-reports/pending/${createdReportId}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe(createdReportId);
    expect(res.body.tester_handle).toBe('@auditor_bob');
  });

  test('Sign pending report with Ed25519 signature', async () => {
    const res = await request(app).post('/api/beta-reports/sign').send({
      id: createdReportId,
      public_key: '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff',
      signature: 'aabbccddeeff11223344556677889900aabbccddeeff11223344556677889900',
      date_signed: '2026-09-05'
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('Attempting to access or sign already signed link returns expired error', async () => {
    const resPending = await request(app).get(`/api/beta-reports/pending/${createdReportId}`);
    expect(resPending.statusCode).toBe(400);
    expect(resPending.body.error).toBe('This link is invalid or has expired');

    const resSignAgain = await request(app).post('/api/beta-reports/sign').send({
      id: createdReportId,
      public_key: '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff',
      signature: 'aabbccddeeff11223344556677889900aabbccddeeff11223344556677889900'
    });
    expect(resSignAgain.statusCode).toBe(400);
    expect(resSignAgain.body.error).toBe('This link is invalid or has expired');
  });

  test('Admin can feature signed report and public trust page renders it', async () => {
    const resToggle = await request(app).post('/api/admin/toggle-featured').send({
      password: adminPass,
      id: createdReportId,
      featured: true
    });
    expect(resToggle.statusCode).toBe(200);

    const resFeatured = await request(app).get('/api/beta-reports/featured');
    expect(resFeatured.statusCode).toBe(200);
    const found = resFeatured.body.find(r => r.id === createdReportId);
    expect(found).toBeDefined();
    expect(found.tester_handle).toBe('@auditor_bob');
  });
});
