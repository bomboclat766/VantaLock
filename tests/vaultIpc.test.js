const { registerVaultIpc } = require('../src/main/vaultIpc');

describe('Vault crypto IPC wiring', () => {
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

  beforeAll(() => {
    registerVaultIpc({
      handle: (channel, handler) => handlers.set(channel, handler)
    }, { lockManager, clipboard });
  });

  function invoke(channel, payload) {
    const handler = handlers.get(channel);
    if (!handler) throw new Error(`No IPC handler registered for ${channel}`);
    return handler({}, payload);
  }

  test('creates credentials, rejects an incorrect password, and encrypts/decrypts through IPC', async () => {
    const password = 'CorrectMasterPassword!2026';
    const credentials = await invoke('create-vault-credentials', password);
    const vaultData = [{ id: 'entry-1', title: 'Test Entry', fields: { password: 'secret' } }];

    await expect(invoke('verify-master-password', {
      password: 'WrongPassword!2026',
      salt: credentials.salt,
      verifier: credentials.verifier
    })).resolves.toBe(false);
    await expect(invoke('verify-master-password', {
      password,
      salt: credentials.salt,
      verifier: credentials.verifier
    })).resolves.toBe(true);

    const encrypted = await invoke('encrypt-vault-data', {
      data: vaultData,
      password,
      salt: credentials.salt
    });
    await expect(invoke('decrypt-vault-data', {
      payload: encrypted,
      password,
      salt: credentials.salt
    })).resolves.toEqual(vaultData);
    await expect(invoke('decrypt-vault-data', {
      payload: encrypted,
      password: 'WrongPassword!2026',
      salt: credentials.salt
    })).rejects.toThrow();
  }, 15000);

  test('round-trips an encrypted backup through the registered IPC handlers', async () => {
    const password = 'BackupMasterPassword!2026';
    const credentials = await invoke('create-vault-credentials', password);
    const entries = [{ id: 'entry-2', title: 'Private Record', fields: { value: 'never plaintext' } }];
    const backup = await invoke('export-encrypted-vault', {
      entries,
      password,
      salt: credentials.salt,
      verifier: credentials.verifier
    });

    expect(JSON.parse(backup).salt).toBe(credentials.salt);
    expect(backup).not.toContain('never plaintext');
    await expect(invoke('import-encrypted-vault', {
      exportString: backup,
      password,
      fallbackSalt: credentials.salt
    })).resolves.toEqual(entries);
    await expect(invoke('import-encrypted-vault', {
      exportString: backup,
      password: 'WrongPassword!2026',
      fallbackSalt: credentials.salt
    })).rejects.toThrow();
  }, 15000);
});
