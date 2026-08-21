const { encryptData, decryptData } = require('./vaultCrypto');

/**
 * Vault Backup & Export Module (Phase 7)
 */

/**
 * Creates an encrypted export package of the vault data.
 * @param {Array} vaultEntries
 * @param {Buffer} derivedKey
 * @returns {string} Encrypted export string payload
 */
function exportEncryptedVault(vaultEntries, derivedKey) {
  const exportPayload = {
    exportedAt: new Date().toISOString(),
    formatVersion: 1,
    entries: vaultEntries
  };
  return JSON.stringify(encryptData(exportPayload, derivedKey));
}

/**
 * Restores vault data from an encrypted export string payload.
 * @param {string} exportString
 * @param {Buffer} derivedKey
 * @returns {Array} Restored vault entries
 */
function importEncryptedVault(exportString, derivedKey) {
  const encryptedPayload = JSON.parse(exportString);
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
