const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  createVaultCredentials: (password) => ipcRenderer.invoke('create-vault-credentials', password),
  verifyMasterPassword: (credentials) => ipcRenderer.invoke('verify-master-password', credentials),
  generateRecoveryKey: () => ipcRenderer.invoke('generate-recovery-key'),
  encryptVaultData: (payload) => ipcRenderer.invoke('encrypt-vault-data', payload),
  decryptVaultData: (payload) => ipcRenderer.invoke('decrypt-vault-data', payload),
  exportEncryptedVault: (payload) => ipcRenderer.invoke('export-encrypted-vault', payload),
  saveEncryptedBackup: (request) => ipcRenderer.invoke('save-encrypted-backup', request),
  importEncryptedVault: (payload) => ipcRenderer.invoke('import-encrypted-vault', payload),
  parsePasswordImportFile: (request) => ipcRenderer.invoke('parse-password-import-file', request),
  lockManagerActivity: () => ipcRenderer.invoke('lock-manager-activity'),
  lockManagerSuccess: () => ipcRenderer.invoke('lock-manager-success'),
  lockManagerLock: (reason) => ipcRenderer.invoke('lock-manager-lock', reason),
  lockManagerSetTimeout: (minutes) => ipcRenderer.invoke('lock-manager-set-timeout', minutes),
  copySensitiveText: (text) => ipcRenderer.invoke('copy-sensitive-text', text),
  onVaultLocked: (callback) => {
    const listener = (_event, reason) => callback(reason);
    ipcRenderer.on('vault-locked', listener);
    return () => ipcRenderer.removeListener('vault-locked', listener);
  },
  isBiometricsAvailable: () => ipcRenderer.invoke('is-biometrics-available'),
  promptBiometrics: (reason) => ipcRenderer.invoke('prompt-biometrics', reason),
  storeSecureToken: (token) => ipcRenderer.invoke('store-secure-token', token),
  unlockWithBiometrics: (encToken) => ipcRenderer.invoke('unlock-with-biometrics', encToken),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  openFileNative: (filePayload) => ipcRenderer.invoke('open-file-native', filePayload)
});
