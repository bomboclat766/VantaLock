const { exportEncryptedVault, importEncryptedVault } = require('../src/crypto/vaultBackup');
const { generateSalt, deriveKey } = require('../src/crypto/vaultCrypto');

describe('Portable Vault Encrypted Export and Import', () => {
  let masterPassword = 'MasterVaultPassword2026!';
  let salt;
  let derivedKey;

  beforeAll(async () => {
    salt = generateSalt();
    derivedKey = await deriveKey(masterPassword, salt);
  });

  test('exportEncryptedVault and importEncryptedVault correctly round-trip vault entries with metadata', () => {
    const originalEntries = [
      { id: '1', title: 'Offshore Checking', fields: { bankName: 'Zurich Bank', accountNumber: 'CH9300000000123456789' } },
      { id: '2', title: 'Passport ID', fields: { number: 'A12345678' } }
    ];

    const exportPayload = exportEncryptedVault(originalEntries, derivedKey, { salt });
    expect(typeof exportPayload).toBe('string');
    expect(exportPayload.includes('Zurich Bank')).toBe(false); // Verified encrypted

    const parsedPackage = JSON.parse(exportPayload);
    expect(parsedPackage.cipher).toBe('AES-256-GCM');
    expect(parsedPackage.kdf).toBe('Argon2id');
    expect(parsedPackage.salt).toBe(salt.toString('hex'));

    const restoredEntries = importEncryptedVault(exportPayload, derivedKey);
    expect(restoredEntries).toEqual(originalEntries);
  });

  test('simulates fresh instance independent decryption using exported salt and master password', async () => {
    const originalEntries = [
      { id: '3', title: 'Crypto Cold Storage', fields: { privateKey: '0xabc123...', seedPhrase: '24 word BIP-39 mnemonic' } }
    ];

    // 1. Export vault from Instance A
    const jsonExport = exportEncryptedVault(originalEntries, derivedKey, { salt });

    // 2. Clear state / Simulate Instance B reading JSON export package
    const packageData = JSON.parse(jsonExport);
    const restoredSalt = Buffer.from(packageData.salt, 'hex');

    // Re-derive key on Instance B using master password and exported salt
    const instanceBKey = await deriveKey(masterPassword, restoredSalt);

    // 3. Import and decrypt on Instance B
    const restoredEntries = importEncryptedVault(jsonExport, instanceBKey);
    expect(restoredEntries).toEqual(originalEntries);
  });
});
