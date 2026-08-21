const { activateLicenseKey } = require('../src/crypto/licenseActivation');
const axios = require('axios');

jest.mock('axios');

describe('Lemon Squeezy License Activation Flow (Phase 8)', () => {
  test('activateLicenseKey returns activated status on successful Lemon Squeezy API response', async () => {
    axios.post.mockResolvedValueOnce({
      data: {
        activated: true,
        instance: { id: 'inst_123456789' }
      }
    });

    const res = await activateLicenseKey('VALID-LEM-SQUEEZY-LICENSE-KEY');
    expect(res.activated).toBe(true);
    expect(res.instanceId).toBe('inst_123456789');
    expect(res.error).toBeNull();
  });

  test('activateLicenseKey handles invalid or already used license key error', async () => {
    axios.post.mockResolvedValueOnce({
      data: {
        activated: false,
        error: 'The license key provided is invalid.'
      }
    });

    const res = await activateLicenseKey('INVALID-LICENSE');
    expect(res.activated).toBe(false);
    expect(res.error).toBe('The license key provided is invalid.');
  });
});
