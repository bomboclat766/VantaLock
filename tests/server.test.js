const request = require('supertest');
const app = require('../server');

describe('Strict Admin Password Verification', () => {
  let adminPass = 'vanta-admin-2026';

  test('Admin authentication rejects empty, blank, or wrong password with Access Denied', async () => {
    const emptyRes = await request(app).post('/api/admin/verify').send({ password: '' });
    expect(emptyRes.statusCode).toBe(401);
    expect(emptyRes.body.error).toBe('Access Denied');

    const blankRes = await request(app).post('/api/admin/verify').send({ password: '   ' });
    expect(blankRes.statusCode).toBe(401);
    expect(blankRes.body.error).toBe('Access Denied');

    const wrongRes = await request(app).post('/api/admin/verify').send({ password: 'invalid_pass' });
    expect(wrongRes.statusCode).toBe(401);
    expect(wrongRes.body.error).toBe('Access Denied');

    const validRes = await request(app).post('/api/admin/verify').send({ password: adminPass });
    expect(validRes.statusCode).toBe(200);
    expect(validRes.body.success).toBe(true);
  });
});
