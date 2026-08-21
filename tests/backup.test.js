const { exportEncryptedVault, importEncryptedVault } = require('../src/crypto/vaultBackup');
const { generateSalt, deriveKey } = require('../src/crypto/vaultCrypto');

describe('Vault Encrypted Export and Import (Phase 7)', () => {
  let derivedKey;

  beforeAll(async () => {
    const salt = generateSalt();
    derivedKey = await deriveKey('BackupPassword123!', salt);
  });

  test('exportEncryptedVault and importEncryptedVault correctly round-trip vault entries', () => {
    const originalEntries = [
      { id: '1', title: 'Offshore Account', fields: { bankName: 'Zurich Bank' } },
      { id: '2', title: 'Passport ID', fields: { number: 'A12345678' } }
    ];

    const exportPayload = exportEncryptedVault(originalEntries, derivedKey);
    expect(typeof exportPayload).toBe('string');
    expect(exportPayload.includes('Zurich Bank')).toBe(false); // Verified encrypted

    const restoredEntries = importEncryptedVault(exportPayload, derivedKey);
    expect(restoredEntries).toEqual(originalEntries);
  });
});
