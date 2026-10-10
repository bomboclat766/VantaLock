use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct VaultEntry {
    pub id: String,
    pub vault: String,
    pub entry_type: String,
    pub title: String,
    pub fields: serde_json::Value,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct VaultHeader {
    pub format_version: u32,
    pub salt_hex: String,
    pub verifier_hex: String,
    pub high_water_timestamp: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct EncryptedVaultFile {
    pub header: VaultHeader,
    pub encrypted_payload_hex: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct VaultPayload {
    pub entries: Vec<VaultEntry>,
    pub decoy_passwords: Vec<String>,
    pub decoy_vault_entries: Vec<VaultEntry>,
    pub failed_attempts: u32,
    pub lockout_expires_at: u64,
    pub lockout_threshold: u32,
    pub lockout_duration_minutes: u32,
}
