use anchor_lang::prelude::*;

#[error_code]
pub enum HubError {
    #[msg("Unauthorized: only admin can perform this action")]
    Unauthorized,

    #[msg("Invalid fee configuration: total fees exceed maximum allowed (10%)")]
    InvalidFeeConfiguration,

    #[msg("Fee percentage exceeds individual limit")]
    FeeExceedsLimit,

    #[msg("Invalid trading limit: min amount must be less than max amount")]
    InvalidTradingLimit,

    #[msg("Invalid timer value: must be greater than zero")]
    InvalidTimerValue,

    #[msg("Invalid address: cannot be zero address")]
    InvalidAddress,

    #[msg("Protocol is globally paused")]
    GloballyPaused,

    #[msg("Operation is paused")]
    OperationPaused,

    #[msg("Invalid program address")]
    InvalidProgramAddress,
}
