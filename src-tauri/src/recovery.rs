use bip39::{Language, Mnemonic};
use rand::RngCore;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum RecoveryError {
    #[error("Invalid recovery seed phrase")]
    InvalidMnemonic,
}

pub fn generate_recovery_phrase() -> String {
    let mut entropy = [0u8; 32]; // 256 bits of entropy for 24 words
    rand::thread_rng().fill_bytes(&mut entropy);
    let mnemonic = Mnemonic::from_entropy_in(Language::English, &entropy).expect("BIP-39 mnemonic generation");
    mnemonic.to_string()
}

pub fn validate_recovery_phrase(phrase: &str) -> Result<(), RecoveryError> {
    Mnemonic::parse_in_normalized(Language::English, phrase).map_err(|_| RecoveryError::InvalidMnemonic)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bip39_generation_and_validation() {
        let phrase = generate_recovery_phrase();
        let words: Vec<&str> = phrase.split_whitespace().collect();
        assert_eq!(words.len(), 24);

        assert!(validate_recovery_phrase(&phrase).is_ok());
        assert!(validate_recovery_phrase("invalid phrase with wrong words").is_err());
    }
}
