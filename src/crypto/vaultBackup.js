const { encryptData, decryptData } = require('./vaultCrypto');

/**
 * Vault Backup & Export Module
 */

/**
 * Creates a self-contained portable encrypted export package of the vault data,
 * including cryptographic metadata (salt, Argon2 params, IV, cipher specs).
 * @param {Array} vaultEntries
 * @param {Buffer} derivedKey
 * @param {Object} [cryptoMeta] Optional salt and KDF params for independent decryption
 * @returns {string} Encrypted export string payload
 */
function exportEncryptedVault(vaultEntries, derivedKey, cryptoMeta = {}) {
  const exportPayload = {
    exportedAt: new Date().toISOString(),
    formatVersion: 1,
    entries: vaultEntries
  };

  const encrypted = encryptData(exportPayload, derivedKey);

  // Attach cryptographic KDF metadata required for portable independent decryption
  const packagePayload = {
    cipher: 'AES-256-GCM',
    kdf: 'Argon2id',
    kdfParams: {
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4
    },
    salt: cryptoMeta.salt ? cryptoMeta.salt.toString('hex') : null,
    encryptedData: encrypted
  };

  return JSON.stringify(packagePayload);
}

/**
 * Restores vault data from an encrypted export string payload.
 * Handles both plain encrypted payloads and self-contained portable packages.
 * @param {string} exportString
 * @param {Buffer} derivedKey
 * @returns {Array} Restored vault entries
 */
function importEncryptedVault(exportString, derivedKey) {
  const parsed = JSON.parse(exportString);
  const encryptedPayload = parsed.encryptedData || parsed;
  const decrypted = decryptData(encryptedPayload, derivedKey);
  if (!decrypted.entries) {
    throw new Error('Invalid export file structure');
  }
  return decrypted.entries;
}

module.exports = {
  exportEncryptedVault,
  importEncryptedVault
};
