use crate::vault_crypto::{decrypt_aes_gcm, derive_key, encrypt_aes_gcm, generate_salt, CryptoError};
use crate::vault_storage::VaultEntry;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum BackupError {
    #[error("Crypto error: {0}")]
    Crypto(#[from] CryptoError),
    #[error("Invalid JSON or backup payload structure")]
    Serialization(#[from] serde_json::Error),
    #[error("Unsupported backup format version")]
    UnsupportedVersion,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct BackupHeader {
    pub format_version: u32,
    pub cipher: String,
    pub kdf: String,
    pub kdf_params: serde_json::Value,
    pub salt_hex: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct BackupPackage {
    pub header: BackupHeader,
    pub encrypted_data_hex: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct BackupPayload {
    pub exported_at: String,
    pub format_version: u32,
    pub entries: Vec<VaultEntry>,
}

pub fn create_backup(password: &str, entries: &[VaultEntry]) -> Result<Vec<u8>, BackupError> {
    let salt = generate_salt();
    let key = derive_key(password, &salt)?;

    let payload = BackupPayload {
        exported_at: "2025-02-23T00:00:00Z".to_string(),
        format_version: 1,
        entries: entries.to_vec(),
    };

    let plaintext = serde_json::to_vec(&payload)?;
    let encrypted = encrypt_aes_gcm(&key, &plaintext)?;

    let package = BackupPackage {
        header: BackupHeader {
            format_version: 1,
            cipher: "AES-256-GCM".to_string(),
            kdf: "Argon2id".to_string(),
            kdf_params: serde_json::json!({
                "memory_cost": 65536,
                "time_cost": 3,
                "parallelism": 4
            }),
            salt_hex: hex::encode(salt),
        },
        encrypted_data_hex: hex::encode(encrypted),
    };

    let backup_json = serde_json::to_vec(&package)?;
    Ok(backup_json)
}

pub fn restore_backup(password: &str, backup_bytes: &[u8]) -> Result<Vec<VaultEntry>, BackupError> {
    let package: BackupPackage = serde_json::from_slice(backup_bytes)?;
    let salt = hex::decode(&package.header.salt_hex).map_err(|_| CryptoError::InvalidBuffer)?;
    let key = derive_key(password, &salt)?;

    let encrypted = hex::decode(&package.encrypted_data_hex).map_err(|_| CryptoError::InvalidBuffer)?;
    let decrypted = decrypt_aes_gcm(&key, &encrypted)?;

    let payload: BackupPayload = serde_json::from_slice(&decrypted)?;
    Ok(payload.entries)
}

pub fn restore_legacy_1_1_49_backup(password: &str, backup_bytes: &[u8]) -> Result<Vec<VaultEntry>, BackupError> {
    #[derive(Deserialize)]
    struct LegacyPackage {
        salt: Option<String>,
        #[serde(rename = "encryptedData")]
        encrypted_data: Option<String>,
    }

    let parsed: LegacyPackage = serde_json::from_slice(backup_bytes)?;

    let salt = if let Some(s) = &parsed.salt {
        hex::decode(s).map_err(|_| CryptoError::InvalidBuffer)?
    } else {
        generate_salt().to_vec()
    };

    let key = derive_key(password, &salt)?;

    let enc_hex = match &parsed.encrypted_data {
        Some(v) => v,
        None => return Err(BackupError::UnsupportedVersion),
    };

    let encrypted_bytes = hex::decode(enc_hex).map_err(|_| CryptoError::InvalidBuffer)?;
    let decrypted = decrypt_aes_gcm(&key, &encrypted_bytes)?;

    let payload: BackupPayload = serde_json::from_slice(&decrypted)?;
    Ok(payload.entries)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_backup_create_and_restore() {
        let entry = VaultEntry {
            id: "e1".to_string(),
            vault: "financial".to_string(),
            entry_type: "bank".to_string(),
            title: "Checking Account".to_string(),
            fields: serde_json::json!({"account_number": "12345"}),
            notes: Some("Private note".to_string()),
            created_at: "2025-01-01T00:00:00Z".to_string(),
            updated_at: "2025-01-01T00:00:00Z".to_string(),
        };

        let backup = create_backup("BackupPassword123!", &[entry.clone()]).unwrap();
        let restored = restore_backup("BackupPassword123!", &backup).unwrap();

        assert_eq!(restored.len(), 1);
        assert_eq!(restored[0], entry);

        // Wrong password fails
        assert!(restore_backup("WrongPassword", &backup).is_err());
    }

    #[test]
    fn test_restore_legacy_1_1_49_backup() {
        let entry = VaultEntry {
            id: "legacy_e1".to_string(),
            vault: "financial".to_string(),
            entry_type: "bank".to_string(),
            title: "Legacy Checking".to_string(),
            fields: serde_json::json!({"account_number": "99999"}),
            notes: Some("Legacy note".to_string()),
            created_at: "2024-01-01T00:00:00Z".to_string(),
            updated_at: "2024-01-01T00:00:00Z".to_string(),
        };

        let password = "LegacyPassword123!";
        let salt = generate_salt();
        let key = derive_key(password, &salt).unwrap();

        let payload = BackupPayload {
            exported_at: "2024-01-01T00:00:00Z".to_string(),
            format_version: 1,
            entries: vec![entry.clone()],
        };

        let plaintext = serde_json::to_vec(&payload).unwrap();
        let encrypted = encrypt_aes_gcm(&key, &plaintext).unwrap();

        let legacy_json = serde_json::json!({
            "cipher": "AES-256-GCM",
            "kdf": "Argon2id",
            "kdfParams": { "memoryCost": 65536, "timeCost": 3, "parallelism": 4 },
            "salt": hex::encode(salt),
            "encryptedData": hex::encode(encrypted)
        });

        let backup_bytes = serde_json::to_vec(&legacy_json).unwrap();
        let restored = restore_legacy_1_1_49_backup(password, &backup_bytes).unwrap();

        assert_eq!(restored.len(), 1);
        assert_eq!(restored[0], entry);
    }
}
