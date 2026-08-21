const bip39 = require('bip39');
const crypto = require('crypto');

/**
 * Recovery Key Module (Phase 3)
 * Uses 24-word BIP-39 mnemonic phrases to derive standard AES-256 vault keys.
 */

/**
 * Generates a 24-word cryptographically random BIP-39 mnemonic phrase.
 * @returns {string} 24 words separated by space
 */
function generateRecoveryKey() {
  // 256 bits of entropy = 24 words in BIP-39
  const entropy = crypto.randomBytes(32);
  return bip39.entropyToMnemonic(entropy.toString('hex'));
}

/**
 * Validates a recovery key phrase format.
 * @param {string} recoveryKey
 * @returns {boolean}
 */
function validateRecoveryKey(recoveryKey) {
  if (!recoveryKey) return false;
  const cleanKey = recoveryKey.trim().toLowerCase();
  return bip39.validateMnemonic(cleanKey);
}

/**
 * Derives a 32-byte AES-256 key from a 24-word recovery key phrase.
 * @param {string} recoveryKey
 * @returns {Buffer} 32-byte encryption key
 */
function deriveKeyFromRecoveryKey(recoveryKey) {
  if (!validateRecoveryKey(recoveryKey)) {
    throw new Error('Invalid recovery key phrase');
  }
  const cleanKey = recoveryKey.trim().toLowerCase();
  const entropyHex = bip39.mnemonicToEntropy(cleanKey);
  // Use SHA-256 hash of entropy to obtain a uniform 32-byte key
  return crypto.createHash('sha256').update(Buffer.from(entropyHex, 'hex')).digest();
}

module.exports = {
  generateRecoveryKey,
  validateRecoveryKey,
  deriveKeyFromRecoveryKey
};
