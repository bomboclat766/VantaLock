const fs = require('fs');
const path = require('path');
const os = require('os');
const VaultStorage = require('../src/crypto/vaultStorage');
const { generateSalt, deriveKey } = require('../src/crypto/vaultCrypto');

describe('Vault Storage & Attachment Encryption (Phase 4)', () => {
  let tmpDir;
  let storage;
  let derivedKey;

  beforeAll(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vantalock-test-'));
    storage = new VaultStorage(tmpDir);
    const salt = generateSalt();
    derivedKey = await deriveKey('MasterPass123!', salt);
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('saveVaultData and loadVaultData perform encrypted CRUD operations', () => {
    const entries = [
      { id: '1', vault: 'financial', type: 'bank_account', title: 'Main Checking', fields: { bankName: 'Chase' } },
      { id: '2', vault: 'personal', type: 'note', title: 'Private Key Backup', fields: { notes: 'Secret phrase' } }
    ];

    storage.saveVaultData(entries, derivedKey);

    const loaded = storage.loadVaultData(derivedKey);
    expect(loaded.length).toBe(2);
    expect(loaded[0].title).toBe('Main Checking');
    expect(loaded[1].fields.notes).toBe('Secret phrase');
  });

  test('saveAttachment and loadAttachment encrypt and decrypt arbitrary files', () => {
    const sampleBuffer = Buffer.from('PDF document secret contents for VantaLock vault', 'utf8');

    const attachmentId = storage.saveAttachment(sampleBuffer, derivedKey);
    expect(typeof attachmentId).toBe('string');

    const retrievedBuffer = storage.loadAttachment(attachmentId, derivedKey);
    expect(retrievedBuffer.toString('utf8')).toBe('PDF document secret contents for VantaLock vault');

    storage.deleteAttachment(attachmentId);
    expect(() => storage.loadAttachment(attachmentId, derivedKey)).toThrow();
  });
});
