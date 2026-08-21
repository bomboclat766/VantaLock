const crypto = require('crypto');
const argon2 = require('argon2');

/**
 * Vault Encryption Module using AES-256-GCM and Argon2id.
 */

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64MB
  timeCost: 3,
  parallelism: 4,
  hashLength: 32 // 256 bits
};

function generateSalt() {
  return crypto.randomBytes(16);
}

async function deriveKey(password, salt) {
  const hash = await argon2.hash(password, {
    ...ARGON2_OPTIONS,
    salt,
    raw: true
  });
  return hash;
}

function createVerifier(derivedKey) {
  const hmac = crypto.createHmac('sha256', derivedKey);
  hmac.update('VANTALOCK_VAULT_VERIFIER_TOKEN');
  return hmac.digest('hex');
}

function verifyKey(derivedKey, storedVerifier) {
  const computed = createVerifier(derivedKey);
  return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(storedVerifier, 'hex'));
}

function encryptData(data, derivedKey) {
  const plaintext = typeof data === 'object' ? JSON.stringify(data) : String(data);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  return {
    ciphertext: encrypted,
    iv: iv.toString('hex'),
    tag
  };
}

function decryptData(encryptedPayload, derivedKey) {
  const { ciphertext, iv, tag } = encryptedPayload;
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    derivedKey,
    Buffer.from(iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(tag, 'hex'));

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  try {
    return JSON.parse(decrypted);
  } catch (e) {
    return decrypted;
  }
}

function calculatePasswordStrength(password) {
  if (!password) return { score: 0, label: 'empty' };

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 14) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score > 4) score = 4;

  const labels = ['weak', 'weak', 'medium', 'strong', 'very strong'];
  return {
    score,
    label: labels[score]
  };
}

module.exports = {
  generateSalt,
  deriveKey,
  createVerifier,
  verifyKey,
  encryptData,
  decryptData,
  calculatePasswordStrength
};
