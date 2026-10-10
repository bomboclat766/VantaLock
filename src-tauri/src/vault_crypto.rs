use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use argon2::{Algorithm, Argon2, ParamsBuilder, Version};
use rand::RngCore;
use thiserror::Error;
use zeroize::{Zeroize, ZeroizeOnDrop};

#[derive(Error, Debug)]
pub enum CryptoError {
    #[error("Argon2id derivation failed")]
    DerivationFailed,
    #[error("AES-256-GCM encryption failed")]
    EncryptionFailed,
    #[error("AES-256-GCM decryption failed or authentication tag mismatch")]
    DecryptionFailed,
    #[error("Invalid buffer length or key format")]
    InvalidBuffer,
}

#[derive(Zeroize, ZeroizeOnDrop)]
pub struct DerivedKey(pub [u8; 32]);

pub fn derive_key(master_password: &str, salt: &[u8]) -> Result<DerivedKey, CryptoError> {
    let params = ParamsBuilder::new()
        .m_cost(65536) // 64 MB
        .t_cost(3)     // 3 iterations
        .p_cost(4)     // 4 threads
        .output_len(32)
        .build()
        .map_err(|_| CryptoError::DerivationFailed)?;

    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

    let mut key_bytes = [0u8; 32];
    argon2
        .hash_password_into(master_password.as_bytes(), salt, &mut key_bytes)
        .map_err(|_| CryptoError::DerivationFailed)?;

    Ok(DerivedKey(key_bytes))
}

pub fn generate_salt() -> [u8; 16] {
    let mut salt = [0u8; 16];
    OsRng.fill_bytes(&mut salt);
    salt
}

pub fn encrypt_aes_gcm(key: &DerivedKey, plaintext: &[u8]) -> Result<Vec<u8>, CryptoError> {
    let cipher = Aes256Gcm::new_from_slice(&key.0).map_err(|_| CryptoError::InvalidBuffer)?;
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|_| CryptoError::EncryptionFailed)?;

    // Format: 12-byte nonce + ciphertext (which includes 16-byte tag)
    let mut output = Vec::with_capacity(12 + ciphertext.len());
    output.extend_from_slice(&nonce_bytes);
    output.extend_from_slice(&ciphertext);

    Ok(output)
}

pub fn decrypt_aes_gcm(key: &DerivedKey, payload: &[u8]) -> Result<Vec<u8>, CryptoError> {
    if payload.len() < 12 + 16 {
        return Err(CryptoError::DecryptionFailed);
    }

    let cipher = Aes256Gcm::new_from_slice(&key.0).map_err(|_| CryptoError::InvalidBuffer)?;
    let nonce = Nonce::from_slice(&payload[..12]);
    let ciphertext = &payload[12..];

    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| CryptoError::DecryptionFailed)
}

#[cfg(unix)]
pub fn lock_memory(slice: &mut [u8]) -> bool {
    unsafe { libc::mlock(slice.as_ptr() as *const _, slice.len()) == 0 }
}

#[cfg(windows)]
pub fn lock_memory(slice: &mut [u8]) -> bool {
    extern "system" {
        fn VirtualLock(lpAddress: *mut std::ffi::c_void, dwSize: usize) -> i32;
    }
    unsafe { VirtualLock(slice.as_mut_ptr() as *mut _, slice.len()) != 0 }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_argon2id_derivation() {
        let salt = generate_salt();
        let key1 = derive_key("Password123!", &salt).unwrap();
        let key2 = derive_key("Password123!", &salt).unwrap();
        assert_eq!(key1.0, key2.0);

        let key3 = derive_key("WrongPassword", &salt).unwrap();
        assert_ne!(key1.0, key3.0);
    }

    #[test]
    fn test_aes_gcm_roundtrip() {
        let salt = generate_salt();
        let key = derive_key("SecretPassword", &salt).unwrap();
        let secret_data = b"VantaLock Confidential Data";

        let encrypted = encrypt_aes_gcm(&key, secret_data).unwrap();
        assert_ne!(encrypted, secret_data);

        let decrypted = decrypt_aes_gcm(&key, &encrypted).unwrap();
        assert_eq!(decrypted, secret_data);
    }

    #[test]
    fn test_tampered_ciphertext_fails() {
        let salt = generate_salt();
        let key = derive_key("SecretPassword", &salt).unwrap();
        let secret_data = b"VantaLock Confidential Data";

        let mut encrypted = encrypt_aes_gcm(&key, secret_data).unwrap();
        let last_idx = encrypted.len() - 1;
        encrypted[last_idx] ^= 0xFF; // Tamper with tag

        assert!(decrypt_aes_gcm(&key, &encrypted).is_err());
    }
}
