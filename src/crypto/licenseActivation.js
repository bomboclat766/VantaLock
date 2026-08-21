const axios = require('axios');

/**
 * Lemon Squeezy License API Activation Module (Phase 8)
 * Connects directly to Lemon Squeezy's built-in License API endpoint.
 * URL: https://api.lemonsqueezy.com/v1/licenses/activate
 */

const LEMON_SQUEEZY_ACTIVATION_URL = 'https://api.lemonsqueezy.com/v1/licenses/activate';

/**
 * Activates a Lemon Squeezy license key for VantaLock.
 * @param {string} licenseKey The license key received by the user
 * @param {string} instanceName Optional device instance label
 * @returns {Promise<{ activated: boolean, instanceId: string|null, error: string|null }>}
 */
async function activateLicenseKey(licenseKey, instanceName = 'VantaLock Desktop Device') {
  if (!licenseKey || typeof licenseKey !== 'string') {
    return { activated: false, instanceId: null, error: 'License key is required.' };
  }

  try {
    const response = await axios.post(
      LEMON_SQUEEZY_ACTIVATION_URL,
      new URLSearchParams({
        license_key: licenseKey.trim(),
        instance_name: instanceName
      }),
      {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000
      }
    );

    if (response.data && response.data.activated) {
      return {
        activated: true,
        instanceId: response.data.instance ? response.data.instance.id : null,
        error: null
      };
    } else {
      const errorMsg = response.data && response.data.error ? response.data.error : 'License key activation failed.';
      return {
        activated: false,
        instanceId: null,
        error: errorMsg
      };
    }
  } catch (err) {
    let errorMsg = 'Failed to connect to Lemon Squeezy activation service.';
    if (err.response && err.response.data && err.response.data.error) {
      errorMsg = err.response.data.error;
    }
    return {
      activated: false,
      instanceId: null,
      error: errorMsg
    };
  }
}

module.exports = {
  activateLicenseKey,
  LEMON_SQUEEZY_ACTIVATION_URL
};
