const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isBiometricsAvailable: () => ipcRenderer.invoke('is-biometrics-available'),
  storeSecureToken: (token) => ipcRenderer.invoke('store-secure-token', token),
  retrieveSecureToken: (encToken) => ipcRenderer.invoke('retrieve-secure-token', encToken)
});
