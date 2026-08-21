const fs = require('fs');
const path = require('path');
const { encryptData, decryptData } = require('./vaultCrypto');

/**
 * Vault Storage Manager (Phase 4)
 * Handles file reading/writing of encrypted vault data payloads and attachments.
 */

class VaultStorage {
  constructor(storageDir) {
    this.storageDir = storageDir;
    this.vaultFilePath = path.join(storageDir, 'vault.enc');
    this.attachmentsDir = path.join(storageDir, 'attachments');
    this.ensureDirectoryStructure();
  }

  ensureDirectoryStructure() {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
    if (!fs.existsSync(this.attachmentsDir)) {
      fs.mkdirSync(this.attachmentsDir, { recursive: true });
    }
  }

  saveVaultData(vaultEntries, derivedKey) {
    const payload = {
      version: 1,
      updatedAt: new Date().toISOString(),
      entries: vaultEntries
    };

    const encrypted = encryptData(payload, derivedKey);
    fs.writeFileSync(this.vaultFilePath, JSON.stringify(encrypted), 'utf8');
  }

  loadVaultData(derivedKey) {
    if (!fs.existsSync(this.vaultFilePath)) {
      return [];
    }

    const raw = fs.readFileSync(this.vaultFilePath, 'utf8');
    const encryptedPayload = JSON.parse(raw);
    const decrypted = decryptData(encryptedPayload, derivedKey);
    return decrypted.entries || [];
  }

  saveAttachment(fileBuffer, derivedKey) {
    const attachmentId = require('crypto').randomBytes(16).toString('hex');
    const encrypted = encryptData(fileBuffer.toString('base64'), derivedKey);

    const attachmentPath = path.join(this.attachmentsDir, `${attachmentId}.enc`);
    fs.writeFileSync(attachmentPath, JSON.stringify(encrypted), 'utf8');

    return attachmentId;
  }

  loadAttachment(attachmentId, derivedKey) {
    const attachmentPath = path.join(this.attachmentsDir, `${attachmentId}.enc`);
    if (!fs.existsSync(attachmentPath)) {
      throw new Error('Attachment file not found');
    }

    const raw = fs.readFileSync(attachmentPath, 'utf8');
    const encryptedPayload = JSON.parse(raw);
    const base64Data = decryptData(encryptedPayload, derivedKey);
    return Buffer.from(base64Data, 'base64');
  }

  deleteAttachment(attachmentId) {
    const attachmentPath = path.join(this.attachmentsDir, `${attachmentId}.enc`);
    if (fs.existsSync(attachmentPath)) {
      fs.unlinkSync(attachmentPath);
    }
  }
}

module.exports = VaultStorage;
