use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::state::{EscrowAccount, EscrowState};
use crate::errors::EscrowError;

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,
    #[account(
        mut,
        has_one = depositor @ EscrowError::Unauthorized,
        seeds = [b"escrow", depositor.key().as_ref(), escrow_account.beneficiary.key().as_ref()],
        bump = escrow_account.bump,
    )]
    pub escrow_account: Account<'info, EscrowAccount>,
    pub system_program: Program<'info, System>,
}

pub fn deposit_handler(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    let escrow_account = &mut ctx.accounts.escrow_account;

    require!(amount > 0, EscrowError::InvalidAmount);
    require!(escrow_account.state == EscrowState::Initialized, EscrowError::EscrowAlreadyDeposited);

    // Transfer SOL from depositor to the escrow PDA
    system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.depositor.to_account_info(),
                to: escrow_account.to_account_info(),
            },
        ),
        amount,
    )?;

    escrow_account.amount = amount;
    escrow_account.state = EscrowState::Deposited;

    Ok(())
}