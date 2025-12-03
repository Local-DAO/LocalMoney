use anchor_lang::prelude::*;

#[error_code]
pub enum ProfileError {
    #[msg("Unauthorized: only profile owner can perform this action")]
    Unauthorized,

    #[msg("Contact information exceeds maximum length (280 characters)")]
    ContactInfoTooLong,

    #[msg("Encryption key exceeds maximum length (280 characters)")]
    EncryptionKeyTooLong,

    #[msg("Unauthorized: only authorized programs can update profile statistics")]
    UnauthorizedProgramCall,

    #[msg("Invalid counter operation: would result in negative value")]
    InvalidCounterOperation,

    #[msg("Active offers counter overflow")]
    ActiveOffersOverflow,

    #[msg("Active trades counter overflow")]
    ActiveTradesOverflow,
}
