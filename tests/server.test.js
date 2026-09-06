const request = require('supertest');
const app = require('../server');

describe('Strict Admin Password Validation & Gating', () => {
  let adminPass = 'vanta-admin-2026';

  test('Admin authentication rejects empty, blank, or wrong password with INVALID CREDENTIALS.', async () => {
    const emptyRes = await request(app).post('/api/admin/verify').send({ password: '' });
    expect(emptyRes.statusCode).toBe(401);
    expect(emptyRes.body.error).toBe('INVALID CREDENTIALS.');

    const blankRes = await request(app).post('/api/admin/verify').send({ password: '   ' });
    expect(blankRes.statusCode).toBe(401);
    expect(blankRes.body.error).toBe('INVALID CREDENTIALS.');

    const wrongRes = await request(app).post('/api/admin/verify').send({ password: 'invalid_pass' });
    expect(wrongRes.statusCode).toBe(401);
    expect(wrongRes.body.error).toBe('INVALID CREDENTIALS.');

    const validRes = await request(app).post('/api/admin/verify').send({ password: adminPass });
    expect(validRes.statusCode).toBe(200);
    expect(validRes.body.success).toBe(true);
  });
});
