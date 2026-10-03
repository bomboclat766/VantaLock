const {
  generateSalt,
  deriveKey,
  createVerifier,
  verifyKey,
  encryptData,
  decryptData
} = require('../crypto/vaultCrypto');
const { generateRecoveryKey } = require('../crypto/recoveryKey');
const { exportEncryptedVault, importEncryptedVault } = require('../crypto/vaultBackup');

function parseSalt(saltHex) {
  if (typeof saltHex !== 'string' || !/^[0-9a-f]{32}$/i.test(saltHex)) {
    throw new Error('Invalid vault salt');
  }
  return Buffer.from(saltHex, 'hex');
}

async function derivePasswordKey(password, saltHex) {
  if (typeof password !== 'string' || password.length === 0) {
    throw new Error('A password is required');
  }
  return deriveKey(password, parseSalt(saltHex));
}

function registerVaultIpc(ipcMain, { lockManager, clipboard }) {
  ipcMain.handle('create-vault-credentials', async (_event, password) => {
    if (typeof password !== 'string' || password.length === 0) {
      throw new Error('A password is required');
    }
    const salt = generateSalt();
    const derivedKey = await deriveKey(password, salt);
    return { salt: salt.toString('hex'), verifier: createVerifier(derivedKey) };
  });

  ipcMain.handle('verify-master-password', async (_event, { password, salt, verifier }) => {
    try {
      const derivedKey = await derivePasswordKey(password, salt);
      return verifyKey(derivedKey, verifier);
    } catch (_error) {
      return false;
    }
  });

  ipcMain.handle('generate-recovery-key', () => generateRecoveryKey());

  ipcMain.handle('encrypt-vault-data', async (_event, { data, password, salt }) => {
    const derivedKey = await derivePasswordKey(password, salt);
    return encryptData(data, derivedKey);
  });

  ipcMain.handle('decrypt-vault-data', async (_event, { payload, password, salt }) => {
    const derivedKey = await derivePasswordKey(password, salt);
    return decryptData(payload, derivedKey);
  });

  ipcMain.handle('export-encrypted-vault', async (_event, { entries, password, salt, verifier }) => {
    const saltBuffer = parseSalt(salt);
    const derivedKey = await derivePasswordKey(password, salt);
    if (!verifyKey(derivedKey, verifier)) {
      throw new Error('Master password is incorrect');
    }
    return exportEncryptedVault(entries, derivedKey, { salt: saltBuffer });
  });

  ipcMain.handle('import-encrypted-vault', async (_event, { exportString, password, fallbackSalt }) => {
    const parsedPackage = JSON.parse(exportString);
    const salt = parsedPackage.salt || fallbackSalt;
    const derivedKey = await derivePasswordKey(password, salt);
    return importEncryptedVault(exportString, derivedKey);
  });

  ipcMain.handle('lock-manager-activity', () => {
    lockManager.resetInactivityTimer();
  });

  ipcMain.handle('lock-manager-success', () => {
    lockManager.recordSuccessfulUnlock();
  });

  ipcMain.handle('lock-manager-lock', (_event, reason) => {
    lockManager.lock(reason || 'User locked vault');
  });

  ipcMain.handle('lock-manager-set-timeout', (_event, minutes) => {
    const value = Number(minutes);
    if (!Number.isFinite(value) || value < 0) throw new Error('Invalid auto-lock timeout');
    lockManager.setAutoLockTimer(value);
  });

  let clipboardTimer = null;
  ipcMain.handle('copy-sensitive-text', (_event, text) => {
    if (typeof text !== 'string') throw new Error('Clipboard text must be a string');
    if (clipboardTimer) clearTimeout(clipboardTimer);
    clipboard.writeText(text);
    clipboardTimer = setTimeout(() => {
      if (clipboard.readText() === text) clipboard.clear();
      clipboardTimer = null;
    }, 30000);
  });
}

module.exports = { registerVaultIpc };