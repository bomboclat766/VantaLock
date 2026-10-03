const { app, BrowserWindow, shell, ipcMain, safeStorage, systemPreferences, clipboard } = require('electron');
const path = require('path');
const LockManager = require('../crypto/lockManager');
const { registerVaultIpc } = require('./vaultIpc');

let mainWindow;
const lockManager = new LockManager({
  autoLockMinutes: 5,
  onLockCallback: (reason) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('vault-locked', reason);
    }
  }
});

registerVaultIpc(ipcMain, { lockManager, clipboard });

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
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
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
        // Fail closed when the native provider is unavailable.
      }
      return false;
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

ipcMain.handle("get-app-version", () => {
  return app.getVersion();
});

ipcMain.handle("open-file-native", async (event, { dataUrl, filename }) => {
  try {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vantalock-'));
    const providedName = typeof filename === 'string' ? filename : '';
    const normalizedName = providedName.replace(/[\\/]+/g, path.sep);
    const basename = path.basename(normalizedName).replace(/[<>:"|?*\x00-\x1f]/g, '_');
    const cleanFilename = basename && basename !== '.' && basename !== '..' ? basename : 'vault_temp_file.txt';
    const filePath = path.join(tempDir, cleanFilename);

    let base64Data = dataUrl || '';
    if (base64Data.includes(',')) {
      base64Data = base64Data.split(',')[1];
    }
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);

    const errorMsg = await shell.openPath(filePath);
    if (errorMsg) {
      return { success: false, error: errorMsg };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
