const {
  generateRecoveryKey,
  validateRecoveryKey,
  deriveKeyFromRecoveryKey
} = require('../src/crypto/recoveryKey');
const {
  encryptData,
  decryptData
} = require('../src/crypto/vaultCrypto');

describe('Recovery Key Flow (Phase 3)', () => {
  test('generateRecoveryKey produces a valid 24-word BIP-39 mnemonic', () => {
    const key = generateRecoveryKey();
    const words = key.split(' ');
    expect(words.length).toBe(24);
    expect(validateRecoveryKey(key)).toBe(true);
  });

  test('validateRecoveryKey correctly identifies invalid phrases', () => {
    expect(validateRecoveryKey('invalid word phrase here')).toBe(false);
    expect(validateRecoveryKey('')).toBe(false);
  });

  test('deriveKeyFromRecoveryKey yields consistent 32-byte key for AES-256-GCM', () => {
    const recoveryKey = generateRecoveryKey();
    const derivedKey1 = deriveKeyFromRecoveryKey(recoveryKey);
    const derivedKey2 = deriveKeyFromRecoveryKey(recoveryKey);

    expect(Buffer.isBuffer(derivedKey1)).toBe(true);
    expect(derivedKey1.length).toBe(32);
    expect(derivedKey1.equals(derivedKey2)).toBe(true);

    const testPayload = { secretNote: 'Recovery key encryption test' };
    const encrypted = encryptData(testPayload, derivedKey1);
    const decrypted = decryptData(encrypted, derivedKey2);

    expect(decrypted).toEqual(testPayload);
  });
});
