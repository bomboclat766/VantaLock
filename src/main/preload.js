const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Biometrics
  isBiometricsAvailable: () => ipcRenderer.invoke('is-biometrics-available'),
  promptBiometrics: (reason) => ipcRenderer.invoke('prompt-biometrics', reason),
  storeSecureToken: (token) => ipcRenderer.invoke('store-secure-token', token),
  retrieveSecureToken: (encToken) => ipcRenderer.invoke('retrieve-secure-token', encToken),

  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // Vault crypto (narrow, safe channels)
  vaultUnlock: (password, saltHex, verifierHex) => 
    ipcRenderer.invoke('vault-unlock', password, saltHex, verifierHex),
  
  vaultCreateMasterPassword: (password) => 
    ipcRenderer.invoke('vault-create-master-password', password),
  
  vaultChangePassword: (oldPassword, newPassword, oldSaltHex, oldVerifierHex) => 
    ipcRenderer.invoke('vault-change-password', oldPassword, newPassword, oldSaltHex, oldVerifierHex),
  
  vaultEncryptEntry: (entryData) => 
    ipcRenderer.invoke('vault-encrypt-entry', entryData),
  
  vaultDecryptEntry: (encryptedPayload) => 
    ipcRenderer.invoke('vault-decrypt-entry', encryptedPayload),
  
  vaultExport: (entriesArray) => 
    ipcRenderer.invoke('vault-export', entriesArray),
  
  vaultImport: (encryptedPayload) => 
    ipcRenderer.invoke('vault-import', encryptedPayload),
  
  vaultLock: () => 
    ipcRenderer.invoke('vault-lock')
});
