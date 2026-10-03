const { app, BrowserWindow, shell, ipcMain, safeStorage, systemPreferences, clipboard } = require('electron');
const path = require('path');
const LockManager = require('../crypto/lockManager');
const { registerVaultIpc } = require('./vaultIpc');
const { registerBiometricsIpc } = require('./biometricsIpc');

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
registerBiometricsIpc(ipcMain, {
  platform: process.platform,
  systemPreferences,
  safeStorage
});

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
