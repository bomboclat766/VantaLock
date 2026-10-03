const { registerBiometricsIpc } = require('../src/main/biometricsIpc');
const {
  enableBiometricUnlock,
  rotateBiometricSecret,
  disableBiometricUnlock,
  unlockWithBiometrics
} = require('../src/renderer/biometricFlow');

function createStorage(initialValues = {}) {
  const values = new Map(Object.entries(initialValues));
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
}

describe('Main-process biometric IPC', () => {
  function setup(platform = 'darwin', promptTouchID = jest.fn().mockResolvedValue(undefined)) {
    const handlers = new Map();
    const systemPreferences = {
      canPromptTouchID: jest.fn(() => true),
      promptTouchID
    };
    const safeStorage = {
      isEncryptionAvailable: jest.fn(() => true),
      encryptString: jest.fn(value => Buffer.from(`encrypted:${value}`)),
      decryptString: jest.fn(value => value.toString().replace('encrypted:', ''))
    };
    registerBiometricsIpc({
      handle: (channel, handler) => handlers.set(channel, handler)
    }, { platform, systemPreferences, safeStorage });
    return { handlers, systemPreferences, safeStorage };
  }

  test('supports Touch ID only on macOS', async () => {
    const mac = setup('darwin');
    const windows = setup('win32');

    expect(mac.handlers.get('is-biometrics-available')()).toBe(true);
    expect(windows.handlers.get('is-biometrics-available')()).toBe(false);
    expect(windows.systemPreferences.canPromptTouchID).not.toHaveBeenCalled();
  });

  test('does not decrypt a secure token when Touch ID is cancelled', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { handlers, safeStorage } = setup('darwin', jest.fn().mockRejectedValue(new Error('cancelled')));
      const encryptedToken = Buffer.from('encrypted:secret').toString('base64');
      await expect(handlers.get('unlock-with-biometrics')({}, encryptedToken)).resolves.toBeNull();
      expect(safeStorage.decryptString).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  test('releases a safeStorage secret only after successful Touch ID', async () => {
    const { handlers, safeStorage, systemPreferences } = setup();
    const encryptedToken = Buffer.from('encrypted:master-password').toString('base64');
    await expect(handlers.get('unlock-with-biometrics')({}, encryptedToken))
      .resolves.toBe('master-password');
    expect(systemPreferences.promptTouchID).toHaveBeenCalledTimes(1);
    expect(safeStorage.decryptString).toHaveBeenCalledTimes(1);
  });
});

describe('Renderer biometric flow', () => {
  test('stores the master secret only after password verification and biometric approval', async () => {
    const storage = createStorage();
    const api = {
      verifyMasterPassword: jest.fn().mockResolvedValue(true),
      promptBiometrics: jest.fn().mockResolvedValue(false),
      storeSecureToken: jest.fn().mockResolvedValue('encrypted-secret')
    };

    await expect(enableBiometricUnlock({
      api, storage, password: 'master', salt: 'salt', verifier: 'verifier'
    })).resolves.toBe(false);
    expect(api.storeSecureToken).not.toHaveBeenCalled();
    expect(storage.getItem('vantalock_biometrics_enabled')).toBeNull();
  });

  test('enables biometrics after verifying the password and authenticating', async () => {
    const storage = createStorage();
    const api = {
      verifyMasterPassword: jest.fn().mockResolvedValue(true),
      promptBiometrics: jest.fn().mockResolvedValue(true),
      storeSecureToken: jest.fn().mockResolvedValue('encrypted-secret')
    };

    await expect(enableBiometricUnlock({
      api, storage, password: 'master', salt: 'salt', verifier: 'verifier'
    })).resolves.toBe(true);
    expect(storage.getItem('vantalock_biometrics_enabled')).toBe('true');
    expect(storage.getItem('vantalock_secure_token')).toBe('encrypted-secret');
  });

  test('does not count cancelled or invalid biometric unlocks as password failures', async () => {
    const storage = createStorage({
      vantalock_biometrics_enabled: 'true',
      vantalock_secure_token: 'encrypted-secret',
      vantalock_vault_salt: 'salt',
      vantalock_vault_verifier: 'verifier'
    });
    const resetFailedAttempts = jest.fn();
    const api = {
      unlockWithBiometrics: jest.fn().mockResolvedValue(null),
      verifyMasterPassword: jest.fn(),
      lockManagerSuccess: jest.fn()
    };

    await expect(unlockWithBiometrics({ api, storage, resetFailedAttempts })).resolves.toBe(false);
    expect(resetFailedAttempts).not.toHaveBeenCalled();
    expect(api.verifyMasterPassword).not.toHaveBeenCalled();

    api.unlockWithBiometrics.mockResolvedValue('wrong-secret');
    api.verifyMasterPassword.mockResolvedValue(false);
    await expect(unlockWithBiometrics({ api, storage, resetFailedAttempts })).resolves.toBe(false);
    expect(resetFailedAttempts).not.toHaveBeenCalled();
    expect(api.lockManagerSuccess).not.toHaveBeenCalled();
  });

  test('resets lockout only after verified biometric unlock, rotates the secret, and removes it on disable', async () => {
    const storage = createStorage({
      vantalock_biometrics_enabled: 'true',
      vantalock_secure_token: 'old-token',
      vantalock_vault_salt: 'salt',
      vantalock_vault_verifier: 'verifier'
    });
    const resetFailedAttempts = jest.fn();
    const api = {
      unlockWithBiometrics: jest.fn().mockResolvedValue('master'),
      verifyMasterPassword: jest.fn().mockResolvedValue(true),
      lockManagerSuccess: jest.fn().mockResolvedValue(undefined),
      storeSecureToken: jest.fn().mockResolvedValue('rotated-token')
    };

    await expect(unlockWithBiometrics({ api, storage, resetFailedAttempts })).resolves.toBe(true);
    expect(resetFailedAttempts).toHaveBeenCalledTimes(1);
    expect(api.lockManagerSuccess).toHaveBeenCalledTimes(1);

    await expect(rotateBiometricSecret({ api, storage, password: 'new-master' })).resolves.toBe(true);
    expect(api.storeSecureToken).toHaveBeenCalledWith('new-master');
    expect(storage.getItem('vantalock_secure_token')).toBe('rotated-token');
    disableBiometricUnlock(storage);
    expect(storage.getItem('vantalock_biometrics_enabled')).toBe('false');
    expect(storage.getItem('vantalock_secure_token')).toBeNull();
  });
});
