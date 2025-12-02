use anchor_lang::prelude::*;
use crate::state::{EscrowAccount, EscrowState};
use crate::errors::EscrowError;

#[derive(Accounts)]
pub struct Cancel<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,
    #[account(
        mut,
        has_one = depositor @ EscrowError::Unauthorized,
        close = depositor, // Close the account and return rent to depositor
        seeds = [b"escrow", depositor.key().as_ref(), escrow_account.beneficiary.key().as_ref()],
        bump = escrow_account.bump,
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
    pub system_program: Program<'info, System>, // Required for closing account
}

pub fn cancel_handler(ctx: Context<Cancel>) -> Result<()> {
    let escrow_account = &mut ctx.accounts.escrow_account;

    require!(escrow_account.state == EscrowState::Deposited, EscrowError::InvalidState);
    require!(escrow_account.amount > 0, EscrowError::NoFundsDeposited);
    require!(
        Clock::get()?.unix_timestamp < escrow_account.unlock_timestamp,
        EscrowError::UnlockTimeAlreadyReached
    );

    // Transfer SOL from escrow PDA back to depositor
    let amount = escrow_account.amount;
    **escrow_account.to_account_info().transfer(&ctx.accounts.depositor.to_account_info(), amount)?;**

    escrow_account.state = EscrowState::Cancelled;
    // Account is closed by Anchor due to `close = depositor`

    Ok(())
}