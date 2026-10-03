const { MAX_BACKUP_FILE_BYTES, registerBackupFileIpc } = require('../src/main/backupFileIpc');

describe('encrypted backup file IPC', () => {
  let handler;
  let dialog;
  let writeFile;
  const mainWindow = { id: 'main-window' };

  beforeEach(() => {
    handler = null;
    dialog = { showSaveDialog: jest.fn() };
    writeFile = jest.fn();
    registerBackupFileIpc({
      handle: (channel, callback) => {
        expect(channel).toBe('save-encrypted-backup');
        handler = callback;
      }
    }, {
      dialog,
      getMainWindow: () => mainWindow,
      writeFile
    });
  });

  test('saves encrypted contents only after the user chooses a file path', async () => {
    dialog.showSaveDialog.mockResolvedValue({ canceled: false, filePath: '/tmp/vault.json' });
    writeFile.mockResolvedValue(undefined);

    await expect(handler({}, {
      contents: '{"cipher":"AES-256-GCM"}',
      filename: 'vantalock-backup-2026-10-03.json'
    })).resolves.toEqual({ canceled: false, saved: true });

    expect(dialog.showSaveDialog).toHaveBeenCalledWith(mainWindow, expect.objectContaining({
      defaultPath: 'vantalock-backup-2026-10-03.json',
      filters: [{ name: 'JSON Backup', extensions: ['json'] }]
    }));
    expect(writeFile).toHaveBeenCalledWith('/tmp/vault.json', '{"cipher":"AES-256-GCM"}', 'utf8');
  });

  test('reports cancellation without writing a file', async () => {
    dialog.showSaveDialog.mockResolvedValue({ canceled: true });

    await expect(handler({}, {
      contents: '{}',
      filename: 'vault-backup.json'
    })).resolves.toEqual({ canceled: true, saved: false });
    expect(writeFile).not.toHaveBeenCalled();
  });

  test('validates names and size before opening the save dialog', async () => {
    await expect(handler({}, { contents: '{}', filename: '../vault.json' }))
      .rejects.toThrow('Invalid encrypted backup file request.');
    await expect(handler({}, {
      contents: 'x'.repeat(MAX_BACKUP_FILE_BYTES + 1),
      filename: 'vault.json'
    })).rejects.toThrow('Encrypted backup files must be 50 MB or smaller.');
    expect(dialog.showSaveDialog).not.toHaveBeenCalled();
  });

  test('surfaces write failures to the renderer caller', async () => {
    dialog.showSaveDialog.mockResolvedValue({ canceled: false, filePath: '/tmp/vault.json' });
    writeFile.mockRejectedValue(new Error('disk full'));

    await expect(handler({}, { contents: '{}', filename: 'vault.json' }))
      .rejects.toThrow('disk full');
  });
});
