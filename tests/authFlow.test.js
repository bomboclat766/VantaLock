const { registerVaultIpc } = require('../src/main/vaultIpc');
const { authenticatePassword } = require('../src/renderer/authFlow');
const { createLockoutState } = require('../src/renderer/lockoutState');

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
}

describe('Renderer unlock and lockout wiring', () => {
  const handlers = new Map();
  const lockManager = {
    resetInactivityTimer: jest.fn(),
    recordSuccessfulUnlock: jest.fn(),
    lock: jest.fn(),
    setAutoLockTimer: jest.fn()
  };
  const clipboard = {
    writeText: jest.fn(),
    readText: jest.fn(() => ''),
    clear: jest.fn()
  };
  let credentials;
  const password = 'CorrectMasterPassword!2026';

  beforeAll(async () => {
    registerVaultIpc({
      handle: (channel, handler) => handlers.set(channel, handler)
    }, { lockManager, clipboard });
    credentials = await handlers.get('create-vault-credentials')({}, password);
  }, 15000);

  function verifyThroughRegisteredIpc(payload) {
    return handlers.get('verify-master-password')({}, payload);
  }

  test('rejects a wrong master password and increments the persisted counter to threshold', async () => {
    const storage = createMemoryStorage();
    storage.setItem('vantalock_lockout_threshold', '2');
    let lockoutTriggered = false;
    const lockout = createLockoutState(storage, () => { lockoutTriggered = true; });
    const attempt = () => authenticatePassword({
      password: 'WrongMasterPassword!2026',
      ...credentials,
      decoyPasswords: [],
      verifyMasterPassword: verifyThroughRegisteredIpc,
      recordFailedAttempt: lockout.recordFailedAttempt,
      resetFailedAttempts: lockout.resetFailedAttempts
    });

    await expect(attempt()).resolves.toMatchObject({ accepted: false, vaultType: null });
    expect(lockout.getFailedAttemptCount()).toBe(1);
    await expect(attempt()).resolves.toMatchObject({ accepted: false, vaultType: null });
    expect(lockout.getFailedAttemptCount()).toBe(2);
    expect(lockoutTriggered).toBe(true);
    expect(storage.getItem('vantalock_lockout_expires_at')).not.toBeNull();
  }, 15000);

  test('accepts the real master password without counting a failure', async () => {
    const storage = createMemoryStorage();
    const lockout = createLockoutState(storage, jest.fn());
    storage.setItem('vantalock_failed_attempts', '1');

    await expect(authenticatePassword({
      password,
      ...credentials,
      decoyPasswords: [],
      verifyMasterPassword: verifyThroughRegisteredIpc,
      recordFailedAttempt: lockout.recordFailedAttempt,
      resetFailedAttempts: lockout.resetFailedAttempts
    })).resolves.toEqual({ accepted: true, vaultType: 'real' });
    expect(lockout.getFailedAttemptCount()).toBe(0);
  }, 15000);

  test('routes only a registered decoy password to the decoy vault without crypto verification', async () => {
    const storage = createMemoryStorage();
    const lockout = createLockoutState(storage, jest.fn());
    const verifyMasterPassword = jest.fn(verifyThroughRegisteredIpc);
    storage.setItem('vantalock_failed_attempts', '1');

    await expect(authenticatePassword({
      password: 'RegisteredDecoy!2026',
      ...credentials,
      decoyPasswords: [{ id: 'decoy-1', password: 'RegisteredDecoy!2026' }],
      verifyMasterPassword,
      recordFailedAttempt: lockout.recordFailedAttempt,
      resetFailedAttempts: lockout.resetFailedAttempts
    })).resolves.toEqual({ accepted: true, vaultType: 'decoy' });
    expect(verifyMasterPassword).not.toHaveBeenCalled();
    expect(lockout.getFailedAttemptCount()).toBe(0);
  }, 15000);
});