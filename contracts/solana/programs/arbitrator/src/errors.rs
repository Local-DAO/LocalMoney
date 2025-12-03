use anchor_lang::prelude::*;

#[error_code]
pub enum ArbitratorError {
    #[msg("Unauthorized: only admin can perform this action")]
    Unauthorized,

    #[msg("Arbitrator already registered for this fiat currency")]
    AlreadyRegistered,

    #[msg("Arbitrator not found for this fiat currency")]
    NotFound,

    #[msg("Arbitrator is not active")]
    NotActive,

    #[msg("No arbitrators available for this fiat currency")]
    NoArbitratorsAvailable,

    #[msg("Invalid fiat currency code")]
    InvalidFiatCurrency,

    #[msg("Only assigned arbitrator can resolve dispute")]
    NotAssignedArbitrator,

    #[msg("Evidence already submitted")]
    EvidenceAlreadySubmitted,

    #[msg("Evidence exceeds maximum length")]
    EvidenceTooLong,

    #[msg("Dispute already resolved")]
    DisputeAlreadyResolved,

    #[msg("Dispute not found")]
    DisputeNotFound,

    #[msg("Cannot arbitrate own trade")]
    ConflictOfInterest,
}
