function registerBiometricsIpc(ipcMain, { platform, systemPreferences, safeStorage }) {
  function isBiometricsAvailable() {
    return platform === 'darwin' && systemPreferences.canPromptTouchID();
  }

  async function promptBiometrics(reason) {
    if (!isBiometricsAvailable()) return false;
    try {
      const promptReason = typeof reason === 'string' && reason.trim()
        ? reason
        : 'Authenticate to unlock VantaLock Vault';
      await systemPreferences.promptTouchID(promptReason);
      return true;
    } catch (error) {
      console.warn('[Biometrics] Authentication was cancelled or failed:', error);
      return false;
    }
  }

  ipcMain.handle('is-biometrics-available', () => isBiometricsAvailable());
  ipcMain.handle('prompt-biometrics', (_event, reason) => promptBiometrics(reason));

  ipcMain.handle('store-secure-token', (_event, tokenString) => {
    if (typeof tokenString !== 'string' || tokenString.length === 0) {
      throw new Error('A non-empty secure token is required');
    }
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('SafeStorage unavailable');
    }
    return safeStorage.encryptString(tokenString).toString('base64');
  });

  ipcMain.handle('unlock-with-biometrics', async (_event, encryptedBase64) => {
    if (!isBiometricsAvailable()) return null;
    if (!await promptBiometrics('Authenticate to unlock VantaLock Vault')) return null;
    if (typeof encryptedBase64 !== 'string' || encryptedBase64.length === 0) {
      throw new Error('A stored biometric token is required');
    }
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('SafeStorage unavailable');
    }
    return safeStorage.decryptString(Buffer.from(encryptedBase64, 'base64'));
  });
}

module.exports = { registerBiometricsIpc };
