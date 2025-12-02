use anchor_lang::prelude::*;

/// Represents the state of the escrow account.
#[account]
pub struct EscrowAccount {
    /// The original depositor of the funds.
    pub depositor: Pubkey,
    /// The beneficiary who can withdraw funds after the unlock time.
    pub beneficiary: Pubkey,
    /// The amount of SOL held in escrow (in lamports).
    pub amount: u64,
    /// The timestamp (Unix epoch) after which funds can be withdrawn.
    pub unlock_timestamp: i64,
    /// The current state of the escrow.
    pub state: EscrowState,
    /// Bump seed for the PDA.
    pub bump: u8,
}

impl EscrowAccount {
    pub const LEN: usize = 8 + // discriminator
        32 + // depositor
        32 + // beneficiary
        8 +  // amount
        8 +  // unlock_timestamp
        1 +  // state (enum)
        1;   // bump
}

/// Enum to represent the different states of the escrow.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum EscrowState {
    /// The escrow has been initialized but no funds have been deposited yet.
    Initialized,
    /// Funds have been deposited into the escrow.
    Deposited,
    /// Funds have been withdrawn by the beneficiary.
    Withdrawn,
    /// The escrow has been cancelled by the depositor.
    Cancelled,
}