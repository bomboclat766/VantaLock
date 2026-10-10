use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub enum CommandInput {
    SetupVault { master_password: String },
    GenerateRecoverySeed,
    UnlockVault { master_password: String },
    UnlockWithBiometric,
    LockVault,
    LockoutStatus,
    SetLockoutPolicy { threshold: u32, duration_minutes: u32 },
    ListEntries { compartment: String },
    GetEntry { id: String },
    CopyField { id: String, field_name: String },
    CreateEntry { payload: serde_json::Value },
    UpdateEntry { id: String, payload: serde_json::Value },
    DeleteEntry { id: String },
    AddAttachment { path: String },
    OpenAttachment { id: String },
    BackupCreate { password: String, target_path: String },
    BackupRestore { password: String, source_path: String },
    ActivateLicense { license_key: String },
    CheckForUpdate,
    GetAppVersion,
}

#[derive(Serialize, Deserialize, Debug, PartialEq)]
pub enum CommandOutput {
    Ok,
    Unlocked,
    LockedOut { seconds_remaining: u64 },
    IncorrectPassword,
    Failed,
    RecoverySeed { phrase: String },
    LockoutStatus { attempts_used: u32, seconds_remaining: u64 },
    EntrySummaries { summaries: Vec<serde_json::Value> },
    NonSecretFields { fields: serde_json::Value },
    EntryId { id: String },
    Version { version: String },
    Error { message: String },
}

pub fn handle_ipc_command(input: CommandInput) -> CommandOutput {
    match input {
        CommandInput::GetAppVersion => CommandOutput::Version {
            version: "1.1.49".to_string(),
        },
        CommandInput::GenerateRecoverySeed => CommandOutput::RecoverySeed {
            phrase: crate::recovery::generate_recovery_phrase(),
        },
        CommandInput::LockVault => CommandOutput::Ok,
        _ => CommandOutput::Ok,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ipc_command_contract() {
        let out = handle_ipc_command(CommandInput::GetAppVersion);
        assert_eq!(
            out,
            CommandOutput::Version {
                version: "1.1.49".to_string()
            }
        );
    }
}
