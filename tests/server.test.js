const request = require('supertest');
const app = require('../server');

describe('Admin Password Verification via Environment Variable', () => {
  const originalEnv = process.env.ADMIN_PASSWORD;

  beforeEach(() => {
    process.env.ADMIN_PASSWORD = 'test_secret_admin_password_123';
  });

  afterEach(() => {
    process.env.ADMIN_PASSWORD = originalEnv;
  });

  test('Accepts correct ADMIN_PASSWORD from env and grants access', async () => {
    const res = await request(app).post('/api/admin/verify').send({ password: 'test_secret_admin_password_123' });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('Rejects wrong password with Access Denied', async () => {
    const res = await request(app).post('/api/admin/verify').send({ password: 'wrong_password_123' });
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Access Denied');
  });

  test('Rejects old hardcoded password when process.env.ADMIN_PASSWORD is unset', async () => {
    delete process.env.ADMIN_PASSWORD;
    const res = await request(app).post('/api/admin/verify').send({ password: '(5TZAx-cU1d6hD2l=Ke6)fZ+ml^!K6&R' });
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Access Denied');
  });
});
