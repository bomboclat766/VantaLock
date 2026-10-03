const MAX_BACKUP_FILE_BYTES = 50 * 1024 * 1024;
const BACKUP_FILENAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}\.json$/i;

function registerBackupFileIpc(ipcMain, { dialog, getMainWindow, writeFile }) {
  ipcMain.handle('save-encrypted-backup', async (_event, request) => {
    if (!request || typeof request !== 'object' || Array.isArray(request) ||
        typeof request.contents !== 'string' ||
        typeof request.filename !== 'string' ||
        !BACKUP_FILENAME_PATTERN.test(request.filename)) {
      throw new Error('Invalid encrypted backup file request.');
    }
    if (Buffer.byteLength(request.contents, 'utf8') > MAX_BACKUP_FILE_BYTES) {
      throw new Error('Encrypted backup files must be 50 MB or smaller.');
    }

    const result = await dialog.showSaveDialog(getMainWindow(), {
      title: 'Save Encrypted Vault Backup',
      defaultPath: request.filename,
      filters: [{ name: 'JSON Backup', extensions: ['json'] }]
    });
    if (result.canceled) return { canceled: true, saved: false };
    if (typeof result.filePath !== 'string' || result.filePath.length === 0) {
      throw new Error('A backup file location was not selected.');
    }
    await writeFile(result.filePath, request.contents, 'utf8');
    return { canceled: false, saved: true };
  });
}

module.exports = { MAX_BACKUP_FILE_BYTES, registerBackupFileIpc };
