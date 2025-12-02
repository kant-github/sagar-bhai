use anchor_lang::prelude::*;
use crate::state::{EscrowAccount, EscrowState};
use crate::errors::EscrowError;

#[derive(Accounts)]
#[instruction(bump: u8)]
pub struct Initialize<'info> {
    /// CHECK: This account is the depositor, signing the transaction.
    #[account(mut)]
    pub depositor: Signer<'info>,
    /// CHECK: This account is the beneficiary, who can withdraw funds.
    pub beneficiary: AccountInfo<'info>,
    #[account(
        init,
        payer = depositor,
        space = EscrowAccount::LEN,
        seeds = [b"escrow", depositor.key().as_ref(), beneficiary.key().as_ref()],
        bump = bump,
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_handler(
    ctx: Context<Initialize>,
    unlock_timestamp: i64,
    bump: u8,
) -> Result<()> {
    require!(unlock_timestamp > Clock::get()?.unix_timestamp, EscrowError::InvalidAmount); // Using InvalidAmount for generic invalid input for now. Better to have a specific error like InvalidUnlockTime.

    let escrow_account = &mut ctx.accounts.escrow_account;
    escrow_account.depositor = ctx.accounts.depositor.key();
    escrow_account.beneficiary = ctx.accounts.beneficiary.key();
    escrow_account.amount = 0; // Initial amount is 0
    escrow_account.unlock_timestamp = unlock_timestamp;
    escrow_account.state = EscrowState::Initialized;
    escrow_account.bump = bump;

    Ok(())
}