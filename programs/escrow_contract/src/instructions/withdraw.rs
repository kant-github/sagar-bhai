use anchor_lang::prelude::*;
use crate::state::{EscrowAccount, EscrowState};
use crate::errors::EscrowError;

#[derive(Accounts)]
pub struct Withdraw<'info> {
    /// CHECK: This account is the beneficiary, signing the transaction.
    #[account(mut)]
    pub beneficiary: Signer<'info>,
    #[account(
        mut,
        has_one = beneficiary @ EscrowError::Unauthorized,
        close = beneficiary, // Close the account and return rent to beneficiary
        seeds = [b"escrow", escrow_account.depositor.key().as_ref(), beneficiary.key().as_ref()],
        bump = escrow_account.bump,
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
    pub system_program: Program<'info, System>, // Required for closing account
}

pub fn withdraw_handler(ctx: Context<Withdraw>) -> Result<()> {
    let escrow_account = &mut ctx.accounts.escrow_account;

    require!(escrow_account.state == EscrowState::Deposited, EscrowError::InvalidState);
    require!(escrow_account.amount > 0, EscrowError::NoFundsDeposited);
    require!(
        Clock::get()?.unix_timestamp >= escrow_account.unlock_timestamp,
        EscrowError::UnlockTimeNotReached
    );

    // Transfer SOL from escrow PDA to beneficiary
    let amount = escrow_account.amount;
    **escrow_account.to_account_info().transfer(&ctx.accounts.beneficiary.to_account_info(), amount)?;**

    escrow_account.state = EscrowState::Withdrawn;
    // Account is closed by Anchor due to `close = beneficiary`

    Ok(())
}