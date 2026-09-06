const request = require('supertest');
const app = require('../server');

describe('Direct Target Password Verification', () => {
  let targetAdminPass = '(5TZAx-cU1d6hD2l=Ke6)fZ+ml^!K6&R';

  test('Accepts target password directly and grants access', async () => {
    const res = await request(app).post('/api/admin/verify').send({ password: targetAdminPass });
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('Rejects wrong password with Access Denied', async () => {
    const res = await request(app).post('/api/admin/verify').send({ password: 'wrong_password_123' });
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Access Denied');
  });
});
