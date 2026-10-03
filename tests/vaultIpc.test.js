const { registerVaultIpc } = require('../src/main/vaultIpc');
const legacyBackupFixture = require('./fixtures/legacy-zero-key-backup.json');

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
    const imported = await invoke('import-encrypted-vault', {
      exportString: backup,
      password,
      fallbackSalt: credentials.salt
    });
    expect(imported).toMatchObject({ ok: true, migrated: false, entries });

    const wrongPassword = await invoke('import-encrypted-vault', {
      exportString: backup,
      password: 'WrongPassword!2026',
      fallbackSalt: credentials.salt
    });
    expect(wrongPassword).toMatchObject({ ok: false, code: 'WRONG_PASSWORD' });
  }, 15000);

  test('imports a legacy zero-key fixture and returns a new password-protected backup', async () => {
    const password = 'CurrentMasterPassword!2026';
    const result = await invoke('import-encrypted-vault', {
      exportString: JSON.stringify(legacyBackupFixture),
      password,
      fallbackSalt: null
    });

    expect(result).toMatchObject({ ok: true, migrated: true });
    expect(result.entries).toEqual([{
      id: 'legacy-1',
      title: 'Legacy Fixture',
      vault: 'personal',
      type: 'login',
      typeName: 'Login',
      fields: { username: 'fixture-user', password: 'fixture-secret' },
      notes: 'Legacy encrypted fixture'
    }]);
    const migratedPackage = JSON.parse(result.migratedBackup);
    expect(migratedPackage.salt).toMatch(/^[0-9a-f]{32}$/);
    expect(result.migratedBackup).not.toContain('fixture-secret');
    const reread = await invoke('import-encrypted-vault', {
      exportString: result.migratedBackup,
      password,
      fallbackSalt: null
    });
    expect(reread).toMatchObject({ ok: true, migrated: false, entries: result.entries });
  }, 15000);

  test('reports unsupported formats and corrupted JSON separately', async () => {
    const unsupported = await invoke('import-encrypted-vault', {
      exportString: JSON.stringify({ cipher: 'unknown', kdf: 'unknown' }),
      password: 'any-password',
      fallbackSalt: null
    });
    expect(unsupported.code).toBe('UNSUPPORTED_FORMAT');

    const corrupted = await invoke('import-encrypted-vault', {
      exportString: '{not json',
      password: 'any-password',
      fallbackSalt: null
    });
    expect(corrupted.code).toBe('CORRUPTED_FILE');
    expect(corrupted.detail).toMatch(/JSON|position|property/i);
  });
});
