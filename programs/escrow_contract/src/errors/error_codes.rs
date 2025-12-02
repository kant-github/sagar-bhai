use anchor_lang::prelude::*;

#[error_code]
pub enum EscrowError {
    #[msg("You are not authorized to perform this action.")]
    Unauthorized,
    #[msg("The escrow is not in the expected state for this action.")]
    InvalidState,
    #[msg("The unlock time has not yet been reached.")]
    UnlockTimeNotReached,
    #[msg("The unlock time has already passed, cancellation is no longer possible.")]
    UnlockTimeAlreadyReached,
    #[msg("Insufficient funds in the escrow account.")]
    InsufficientFunds,
    #[msg("Funds have already been deposited into this escrow.")]
    EscrowAlreadyDeposited,
    #[msg("No funds have been deposited into this escrow yet.")]
    NoFundsDeposited,
    #[msg("The provided amount is zero or invalid.")]
    InvalidAmount,
}