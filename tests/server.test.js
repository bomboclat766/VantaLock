const request = require('supertest');
const app = require('../server');

describe('Strict Admin Password Verification with Target Render Password', () => {
  let targetAdminPass = '(5TZAx-cU1d6hD2l=Ke6)fZ+ml^!K6&R';

  test('Rejects invalid passwords with Access Denied', async () => {
    const wrongRes = await request(app).post('/api/admin/verify').send({ password: 'wrong_pass' });
    expect(wrongRes.statusCode).toBe(401);
    expect(wrongRes.body.error).toBe('Access Denied');
  });

  test('Accepts target Render password (5TZAx-cU1d6hD2l=Ke6)fZ+ml^!K6&R', async () => {
    const validRes = await request(app).post('/api/admin/verify').send({ password: targetAdminPass });
    expect(validRes.statusCode).toBe(200);
    expect(validRes.body.success).toBe(true);
  });
});
