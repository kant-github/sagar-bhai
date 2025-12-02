use anchor_lang::prelude::*;

pub mod state;
pub mod instructions;
pub mod errors;

use instructions::*;
use errors::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"); // Placeholder ID, will be updated on deploy

#[program]
pub mod escrow_contract {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        unlock_timestamp: i64,
        bump: u8,
    ) -> Result<()> {
        instructions::initialize_handler(ctx, unlock_timestamp, bump)
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        instructions::deposit_handler(ctx, amount)
    }

    pub fn withdraw(ctx: Context<Withdraw>) -> Result<()> {
        instructions::withdraw_handler(ctx)
    }

    pub fn cancel(ctx: Context<Cancel>) -> Result<()> {
        instructions::cancel_handler(ctx)
    }
}