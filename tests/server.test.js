const request = require('supertest');
const app = require('../server');

describe('Priority Fixes: Admin Auth & API Routes', () => {
  let adminPass = 'vanta-admin-2026';
  let createdReportId = '';

  test('Admin authentication rejects empty, blank, or wrong password', async () => {
    const emptyRes = await request(app).post('/api/admin/verify').send({ password: '' });
    expect(emptyRes.statusCode).toBe(401);

    const blankRes = await request(app).post('/api/admin/verify').send({ password: '   ' });
    expect(blankRes.statusCode).toBe(401);

    const wrongRes = await request(app).post('/api/admin/verify').send({ password: 'invalid_pass' });
    expect(wrongRes.statusCode).toBe(401);

    const validRes = await request(app).post('/api/admin/verify').send({ password: adminPass });
    expect(validRes.statusCode).toBe(200);
    expect(validRes.body.success).toBe(true);
  });

  test('GET /api/beta-reports/featured returns 200 with array', async () => {
    const res = await request(app).get('/api/beta-reports/featured');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('Admin create pending signing link & verify flow', async () => {
    const res = await request(app).post('/api/admin/create-pending-report').send({
      password: adminPass,
      tester_handle: '@priority_test',
      report_text: 'Verified admin auth and endpoint accessibility.'
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    createdReportId = res.body.id;

    // Verify pending link active
    const pendingRes = await request(app).get(`/api/beta-reports/pending/${createdReportId}`);
    expect(pendingRes.statusCode).toBe(200);

    // Sign report
    const signRes = await request(app).post('/api/beta-reports/sign').send({
      id: createdReportId,
      public_key: '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff',
      signature: 'aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899'
    });
    expect(signRes.statusCode).toBe(200);

    // Softened inactive state check for completed sign link
    const inactiveRes = await request(app).get(`/api/beta-reports/pending/${createdReportId}`);
    expect(inactiveRes.statusCode).toBe(400);
    expect(inactiveRes.body.error).toBe("This signing link isn't active");
  });
});
