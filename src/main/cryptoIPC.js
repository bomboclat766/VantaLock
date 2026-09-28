const crypto = require('crypto');
const argon2 = require('argon2');

/**
 * Crypto Handler for Main Process
 * 
 * Session Key Management:
 * - Derived keys are held in memory ONLY in the main process.
 * - Never serialized or sent to renderer (even as hex).
 * - Cleared on lock() or app quit.
 */

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64MB
  timeCost: 3,
  parallelism: 4,
  hashLength: 32 // 256 bits
};

let sessionDerivedKey = null; // Held in main process memory only

/**
 * Generate a random 16-byte salt and return as hex string
 */
function generateSalt() {
  const saltBuffer = crypto.randomBytes(16);
  return saltBuffer.toString('hex');
}

/**
 * Derive a key from password and salt (hex string).
 * Returns the derived key as a Buffer (kept in memory, not serialized).
 */
async function deriveKey(password, saltHex) {
  if (typeof password !== 'string' || !password) {
    throw new Error('Invalid password');
  }
  if (typeof saltHex !== 'string' || saltHex.length !== 32) {
    throw new Error('Invalid salt (must be hex string of length 32)');
  }

  const saltBuffer = Buffer.from(saltHex, 'hex');
  const hash = await argon2.hash(password, {
    ...ARGON2_OPTIONS,
    salt: saltBuffer,
    raw: true
  });
  return hash;
}

/**
 * Create a verifier string from a derived key (Buffer).
 * Returns hex-encoded HMAC-SHA256.
 */
function createVerifier(derivedKeyBuffer) {
  if (!Buffer.isBuffer(derivedKeyBuffer) || derivedKeyBuffer.length !== 32) {
    throw new Error('Invalid derived key');
  }
  const hmac = crypto.createHmac('sha256', derivedKeyBuffer);
  hmac.update('VANTALOCK_VAULT_VERIFIER_TOKEN');
  return hmac.digest('hex');
}

/**
 * Verify a password against stored verifier.
 * Derives key from password + salt, compares HMAC.
 */
async function verifyKey(password, saltHex, storedVerifier) {
  if (typeof storedVerifier !== 'string') {
    throw new Error('Invalid verifier');
  }
  const derivedKey = await deriveKey(password, saltHex);
  const computed = createVerifier(derivedKey);
  try {
    return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(storedVerifier, 'hex'));
  } catch (e) {
    return false;
  }
}

/**
 * Encrypt plaintext (object or string) with derived key (Buffer).
 * Returns { ciphertext, iv, tag } with all values as hex strings.
 */
function encryptData(data, derivedKeyBuffer) {
  if (!Buffer.isBuffer(derivedKeyBuffer) || derivedKeyBuffer.length !== 32) {
    throw new Error('Invalid derived key');
  }
  const plaintext = typeof data === 'object' ? JSON.stringify(data) : String(data);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', derivedKeyBuffer, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');

  return {
    ciphertext: encrypted,
    iv: iv.toString('hex'),
    tag
  };
}

/**
 * Decrypt ciphertext with derived key (Buffer).
 * Expects { ciphertext, iv, tag } with all values as hex strings.
 */
function decryptData(encryptedPayload, derivedKeyBuffer) {
  if (!Buffer.isBuffer(derivedKeyBuffer) || derivedKeyBuffer.length !== 32) {
    throw new Error('Invalid derived key');
  }
  if (typeof encryptedPayload.ciphertext !== 'string' || typeof encryptedPayload.iv !== 'string' || typeof encryptedPayload.tag !== 'string') {
    throw new Error('Invalid encrypted payload format');
  }

  const { ciphertext, iv, tag } = encryptedPayload;
  const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKeyBuffer, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  try {
    return JSON.parse(decrypted);
  } catch (e) {
    return decrypted;
  }
}

/**
 * Set the session derived key.
 * Called after successful unlock; held in memory until lock() is called.
 */
function setSessionKey(derivedKeyBuffer) {
  if (!Buffer.isBuffer(derivedKeyBuffer) || derivedKeyBuffer.length !== 32) {
    throw new Error('Invalid derived key');
  }
  sessionDerivedKey = derivedKeyBuffer;
}

/**
 * Get the session derived key (if set).
 * Returns null if not unlocked.
 */
function getSessionKey() {
  return sessionDerivedKey;
}

/**
 * Clear the session derived key.
 * Called on lock or app quit.
 */
function clearSessionKey() {
  // Overwrite with zeros before nullifying
  if (sessionDerivedKey) {
    sessionDerivedKey.fill(0);
  }
  sessionDerivedKey = null;
}

module.exports = {
  generateSalt,
  deriveKey,
  createVerifier,
  verifyKey,
  encryptData,
  decryptData,
  setSessionKey,
  getSessionKey,
  clearSessionKey
};
