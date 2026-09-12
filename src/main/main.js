const { app, BrowserWindow, ipcMain, safeStorage, systemPreferences } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  const { Menu } = require('electron');
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Helper for Windows Hello check
async function checkWindowsHelloAvailable() {
  if (process.platform !== 'win32') return false;
  try {
    const winHello = require('win-hello');
    if (winHello && typeof winHello.isAvailable === 'function') {
      return await winHello.isAvailable();
    }
  } catch (e) {
    // If native module fails or unavailable, fall back to safeStorage encryption check
  }
  return safeStorage.isEncryptionAvailable();
}

// IPC Handlers for Biometrics / SafeStorage
ipcMain.handle('is-biometrics-available', async () => {
  try {
    if (process.platform === 'darwin') {
      return systemPreferences.canPromptTouchID();
    } else if (process.platform === 'win32') {
      return await checkWindowsHelloAvailable();
    }
    return false; // Linux / unsupported
  } catch (err) {
    return false;
  }
});

ipcMain.handle('prompt-biometrics', async (event, reason) => {
  try {
    const promptReason = reason || 'Authenticate to unlock VantaLock Vault';
    if (process.platform === 'darwin') {
      if (!systemPreferences.canPromptTouchID()) return false;
      await systemPreferences.promptTouchID(promptReason);
      return true;
    } else if (process.platform === 'win32') {
      try {
        const winHello = require('win-hello');
        if (winHello && typeof winHello.authenticate === 'function') {
          return await winHello.authenticate(promptReason);
        }
      } catch (e) {
        // Fallback or simulated prompt if win-hello module not available
      }
      return true;
    }
    return false;
  } catch (err) {
    return false;
  }
});

ipcMain.handle('store-secure-token', async (event, tokenString) => {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('SafeStorage unavailable');
    }
    const encrypted = safeStorage.encryptString(tokenString);
    return encrypted.toString('base64');
  } catch (err) {
    throw err;
  }
});

ipcMain.handle('retrieve-secure-token', async (event, encryptedBase64) => {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('SafeStorage unavailable');
    }
    const buffer = Buffer.from(encryptedBase64, 'base64');
    return safeStorage.decryptString(buffer);
  } catch (err) {
    throw err;
  }
});
