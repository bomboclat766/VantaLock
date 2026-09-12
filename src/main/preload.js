const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isBiometricsAvailable: () => ipcRenderer.invoke('is-biometrics-available'),
  promptBiometrics: (reason) => ipcRenderer.invoke('prompt-biometrics', reason),
  storeSecureToken: (token) => ipcRenderer.invoke('store-secure-token', token),
  retrieveSecureToken: (encToken) => ipcRenderer.invoke('retrieve-secure-token', encToken)
});
