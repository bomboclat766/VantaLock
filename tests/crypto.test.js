const {
  generateSalt,
  deriveKey,
  createVerifier,
  verifyKey,
  encryptData,
  decryptData,
  calculatePasswordStrength
} = require('../src/crypto/vaultCrypto');

describe('Vault Encryption Core (Phase 2)', () => {
  const masterPassword = 'CorrectHorseBatteryStaple!2025';
  let salt;
  let derivedKey;
  let verifier;

  beforeAll(async () => {
    salt = generateSalt();
    derivedKey = await deriveKey(masterPassword, salt);
    verifier = createVerifier(derivedKey);
  }, 10000);

  test('deriveKey produces 32-byte key from Argon2id', () => {
    expect(Buffer.isBuffer(derivedKey)).toBe(true);
    expect(derivedKey.length).toBe(32);
  });

  test('verifyKey confirms correct key and rejects incorrect key', async () => {
    expect(verifyKey(derivedKey, verifier)).toBe(true);

    const wrongKey = await deriveKey('WrongPassword123!', salt);
    expect(verifyKey(wrongKey, verifier)).toBe(false);
  });

  test('encryptData and decryptData perform loss-less AES-256-GCM roundtrip', () => {
    const sensitivePayload = {
      bankName: 'Swiss Private Bank',
      accountNumber: 'CH93-0000-0000-0000-0000-0',
      balance: '$1,500,000'
    };

    const encrypted = encryptData(sensitivePayload, derivedKey);
    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.tag).toBeDefined();

    const decrypted = decryptData(encrypted, derivedKey);
    expect(decrypted).toEqual(sensitivePayload);
  });

  test('calculatePasswordStrength accurately scores password complexity', () => {
    expect(calculatePasswordStrength('12345').label).toBe('weak');
    expect(calculatePasswordStrength('password123').label).toBe('medium');
    expect(calculatePasswordStrength('CorrectHorseBatteryStaple!2025').label).toBe('very strong');
  });
});
