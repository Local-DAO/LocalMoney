use anchor_lang::prelude::*;

#[error_code]
pub enum EscrowError {
    #[msg("Unauthorized: only authorized programs can perform this action")]
    Unauthorized,

    #[msg("Escrow is frozen due to dispute")]
    EscrowFrozen,

    #[msg("Escrow is not frozen")]
    EscrowNotFrozen,

    #[msg("Insufficient escrow balance")]
    InsufficientBalance,

    #[msg("Invalid token amount")]
    InvalidAmount,

    #[msg("Invalid fee configuration")]
    InvalidFeeConfiguration,

    #[msg("Token mint mismatch")]
    TokenMintMismatch,

    #[msg("Escrow already funded")]
    AlreadyFunded,

    #[msg("Escrow not funded")]
    NotFunded,

    #[msg("Invalid recipient address")]
    InvalidRecipient,

    #[msg("Arithmetic overflow in fee calculation")]
    ArithmeticOverflow,
}
