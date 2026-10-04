const {
  generateSalt,
  deriveKey,
  createVerifier,
  verifyKey,
  encryptData,
  decryptData
} = require('../crypto/vaultCrypto');
const { generateRecoveryKey, validateRecoveryKey } = require('../crypto/recoveryKey');
const { exportEncryptedVault } = require('../crypto/vaultBackup');
const { parsePasswordImportFile } = require('./passwordImport');

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

function importFailure(code, message, detail) {
  return { ok: false, code, message, detail: detail || message };
}

function isEncryptedPayload(payload) {
  return Boolean(
    payload &&
    typeof payload.ciphertext === 'string' && /^[0-9a-f]+$/i.test(payload.ciphertext) &&
    typeof payload.iv === 'string' && /^[0-9a-f]{24}$/i.test(payload.iv) &&
    typeof payload.tag === 'string' && /^[0-9a-f]{32}$/i.test(payload.tag)
  );
}

function validateBackupData(data) {
  if (!data || typeof data !== 'object' || data.formatVersion !== 1) {
    const error = new Error('Unsupported backup data version');
    error.code = 'UNSUPPORTED_FORMAT';
    throw error;
  }
  if (!Array.isArray(data.entries)) {
    throw new Error('Backup entries must be an array');
  }
  return data.entries;
}

function registerVaultIpc(ipcMain, { lockManager, clipboard }) {
  ipcMain.handle('parse-password-import-file', (_event, request) => parsePasswordImportFile(request));

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

  ipcMain.handle('export-encrypted-vault', async (_event, {
    entries, password, salt, verifier, credentialType = 'master'
  }) => {
    const saltBuffer = parseSalt(salt);
    if (credentialType !== 'master' && credentialType !== 'recovery') {
      throw new Error('Unsupported backup credential type');
    }
    if (credentialType === 'recovery' && !validateRecoveryKey(password)) {
      throw new Error('The recovery phrase is invalid');
    }
    const derivedKey = await derivePasswordKey(password, salt);
    if (credentialType === 'master' && !verifyKey(derivedKey, verifier)) {
      throw new Error('Master password is incorrect');
    }
    return exportEncryptedVault(entries, derivedKey, { salt: saltBuffer });
  });

  ipcMain.handle('import-encrypted-vault', async (_event, {
    exportString, password, fallbackSalt, fallbackVerifier, credentialType = 'master'
  }) => {
    if (credentialType !== 'master' && credentialType !== 'recovery') {
      return importFailure('UNSUPPORTED_CREDENTIAL', 'Unsupported backup credential type.');
    }
    if (credentialType === 'recovery' && !validateRecoveryKey(password)) {
      return importFailure('WRONG_PASSWORD', 'The recovery phrase is invalid.');
    }
    let parsedPackage;
    try {
      parsedPackage = JSON.parse(exportString);
    } catch (error) {
      return importFailure('CORRUPTED_FILE', 'Corrupted backup file: the file is not valid JSON.', error.message);
    }

    if (!parsedPackage || typeof parsedPackage !== 'object' || Array.isArray(parsedPackage)) {
      return importFailure('UNSUPPORTED_FORMAT', 'Unsupported backup format.');
    }
    if (parsedPackage.cipher !== 'AES-256-GCM' || parsedPackage.kdf !== 'Argon2id') {
      return importFailure('UNSUPPORTED_FORMAT', 'Unsupported backup format or encryption algorithm.');
    }
    const params = parsedPackage.kdfParams;
    if (!params || params.memoryCost !== 65536 || params.timeCost !== 3 || params.parallelism !== 4) {
      return importFailure('UNSUPPORTED_FORMAT', 'Unsupported backup key-derivation parameters.');
    }
    if (!isEncryptedPayload(parsedPackage.encryptedData)) {
      return importFailure('CORRUPTED_FILE', 'Corrupted backup file: encrypted payload is incomplete or malformed.');
    }

    if (parsedPackage.salt === null) {
      let validCurrentMaster = false;
      try {
        const currentKey = await derivePasswordKey(password, fallbackSalt);
        validCurrentMaster = verifyKey(currentKey, fallbackVerifier);
      } catch (_error) {
        validCurrentMaster = false;
      }
      if (!validCurrentMaster) {
        return importFailure(
          'WRONG_PASSWORD',
          'Enter the current master password to migrate this legacy backup.'
        );
      }

      let entries;
      try {
        const legacyKey = Buffer.alloc(32);
        entries = validateBackupData(decryptData(parsedPackage.encryptedData, legacyKey));
      } catch (error) {
        const code = error.code === 'UNSUPPORTED_FORMAT' ? error.code : 'CORRUPTED_FILE';
        const message = code === 'UNSUPPORTED_FORMAT'
          ? 'Unsupported legacy backup data version.'
          : 'Corrupted legacy backup file: encrypted payload could not be authenticated.';
        return importFailure(code, message, error.message);
      }

      let migratedBackup;
      try {
        const migratedSalt = generateSalt();
        const migratedKey = await deriveKey(password, migratedSalt);
        migratedBackup = exportEncryptedVault(entries, migratedKey, { salt: migratedSalt });
      } catch (error) {
        return importFailure('WRONG_PASSWORD', 'A current master password is required to protect the migrated backup.', error.message);
      }
      return { ok: true, entries, migrated: true, migratedBackup };
    }

    if (typeof parsedPackage.salt !== 'string' || !/^[0-9a-f]{32}$/i.test(parsedPackage.salt)) {
      return importFailure('CORRUPTED_FILE', 'Corrupted backup file: salt is missing or malformed.');
    }

    let derivedKey;
    try {
      derivedKey = await derivePasswordKey(password, parsedPackage.salt);
    } catch (error) {
      return importFailure('WRONG_PASSWORD', 'Wrong password or invalid password input.', error.message);
    }

    try {
      const entries = validateBackupData(decryptData(parsedPackage.encryptedData, derivedKey));
      return { ok: true, entries, migrated: false, migratedBackup: null };
    } catch (error) {
      if (error.code === 'UNSUPPORTED_FORMAT') {
        return importFailure('UNSUPPORTED_FORMAT', 'Unsupported backup data version.', error.message);
      }
      if (error.message === 'Backup entries must be an array') {
        return importFailure('CORRUPTED_FILE', 'Corrupted backup file: entries are malformed.', error.message);
      }
      return importFailure('WRONG_PASSWORD', 'Wrong password: this backup could not be authenticated.', error.message);
    }
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