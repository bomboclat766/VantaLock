const request = require('supertest');
const app = require('../server').default || require('../server');

describe('Server & Beta Reports Endpoints', () => {
  let testReportId = '';

  test('GET /beta-testers should return 200 OK', async () => {
    const res = await request(app).get('/beta-testers');
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain('Cryptographically Verified Beta Reports');
  });

  test('GET /beta-sign should return 200 OK', async () => {
    const res = await request(app).get('/beta-sign');
    expect(res.statusCode).toBe(200);
    expect(res.text).toContain('Beta Report Signing');
  });

  test('POST /api/beta-reports should create a report', async () => {
    const payload = {
      tester_handle: '@test_auditor',
      report_text: 'VantaLock local encryption verified zero telemetry.',
      public_key: '11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff',
      signature: 'aabbccddeeff11223344556677889900aabbccddeeff11223344556677889900',
      date_signed: '2026-09-05'
    };

    const res = await request(app).post('/api/beta-reports').send(payload);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.id).toBeDefined();
    testReportId = res.body.id;
  });

  test('Admin authentication & featured toggling', async () => {
    const adminPass = 'vanta-admin-2026';

    // 1. Verify invalid pass
    const badAuth = await request(app).post('/api/admin/verify').send({ password: 'wrong' });
    expect(badAuth.statusCode).toBe(401);

    // 2. Fetch all reports
    const allReports = await request(app).post('/api/admin/beta-reports').send({ password: adminPass });
    expect(allReports.statusCode).toBe(200);
    expect(Array.isArray(allReports.body)).toBe(true);

    // 3. Toggle featured true
    const toggleRes = await request(app).post('/api/admin/toggle-featured').send({
      password: adminPass,
      id: testReportId,
      featured: true
    });
    expect(toggleRes.statusCode).toBe(200);

    // 4. Fetch featured reports publicly
    const featured = await request(app).get('/api/beta-reports/featured');
    expect(featured.statusCode).toBe(200);
    const found = featured.body.find(r => r.id === testReportId);
    expect(found).toBeDefined();
    expect(found.tester_handle).toBe('@test_auditor');
  });
});
