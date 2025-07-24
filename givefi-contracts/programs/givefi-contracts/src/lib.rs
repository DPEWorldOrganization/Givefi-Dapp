use anchor_lang::prelude::*;
use anchor_lang::system_program::{Transfer, transfer};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg4hp3bP39uG");

#[program]
pub mod givefi_contracts {
    use super::*;

    pub fn create_raffle(ctx: Context<CreateRaffle>, prize: String, entry_fee: u64, max_entries: u32, end_timestamp: i64) -> Result<()> {
        let raffle = &mut ctx.accounts.raffle;
        let clock = Clock::get()?;
        
        raffle.host = ctx.accounts.host.key();
        raffle.prize = prize;
        raffle.entry_fee = entry_fee;
        raffle.max_entries = max_entries;
        raffle.entries = 0;
        raffle.end_timestamp = end_timestamp;
        raffle.winner = None;
        raffle.created_at = clock.unix_timestamp;
        
        msg!("Raffle created successfully");
        Ok(())
    }

    pub fn enter_raffle(ctx: Context<EnterRaffle>) -> Result<()> {
        let raffle = &mut ctx.accounts.raffle;
        let clock = Clock::get()?;
        
        require!(clock.unix_timestamp < raffle.end_timestamp, CustomError::RaffleEnded);
        require!(raffle.entries < raffle.max_entries, CustomError::RaffleFull);
        require!(raffle.winner.is_none(), CustomError::WinnerAlreadySelected);
        
        // Transfer entry fee from participant to raffle treasury
        let cpi_accounts = Transfer {
            from: ctx.accounts.participant.to_account_info(),
            to: ctx.accounts.treasury.to_account_info(),
        };
        let cpi_program = ctx.accounts.system_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        transfer(cpi_ctx, raffle.entry_fee)?;
        
        raffle.entries += 1;
        
        msg!("Entry successful, total entries: {}", raffle.entries);
        Ok(())
    }

    pub fn select_winner(ctx: Context<SelectWinner>) -> Result<()> {
        let raffle = &mut ctx.accounts.raffle;
        let clock = Clock::get()?;
        
        require!(clock.unix_timestamp >= raffle.end_timestamp, CustomError::RaffleNotEnded);
        require!(raffle.entries > 0, CustomError::NoEntries);
        require!(raffle.winner.is_none(), CustomError::WinnerAlreadySelected);
        
        // Simple pseudo-random selection using clock and slot
        let slot = clock.slot;
        let winner_index = (slot % raffle.entries as u64) as u32;
        
        // For now, we'll mark that a winner was selected
        // In a real implementation, you'd track participants and select the actual winner
        raffle.winner = Some(ctx.accounts.winner_account.key());
        
        msg!("Winner selected at index: {}", winner_index);
        Ok(())
    }

    pub fn winner_choice(ctx: Context<WinnerChoice>, choice: u8) -> Result<()> {
        let raffle = &mut ctx.accounts.raffle;
        
        require!(raffle.winner.is_some(), CustomError::NoWinnerSelected);
        require!(raffle.winner.unwrap() == ctx.accounts.winner.key(), CustomError::NotTheWinner);
        require!(choice <= 1, CustomError::InvalidChoice);
        
        let total_pool = raffle.entry_fee * raffle.entries as u64;
        
        if choice == 0 {
            // Take full prize
            msg!("Winner chose to take full prize: {} lamports", total_pool);
        } else {
            // Split with charity (50/50)
            let winner_amount = total_pool / 2;
            let charity_amount = total_pool - winner_amount;
            msg!("Winner chose to split: {} to winner, {} to charity", winner_amount, charity_amount);
        }
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreateRaffle<'info> {
    #[account(mut)]
    pub host: Signer<'info>,
    
    #[account(
        init,
        payer = host,
        space = 8 + 32 + 4 + 200 + 8 + 4 + 4 + 8 + 1 + 32 + 8, // discriminator + host + prize_len + prize + entry_fee + max_entries + entries + end_timestamp + winner_option + winner + created_at
        seeds = [b"raffle", host.key().as_ref()],
        bump
    )]
    pub raffle: Account<'info, Raffle>,
    
    #[account(mut)]
    pub treasury: SystemAccount<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct EnterRaffle<'info> {
    #[account(mut)]
    pub participant: Signer<'info>,
    
    #[account(mut)]
    pub raffle: Account<'info, Raffle>,
    
    #[account(mut)]
    pub treasury: SystemAccount<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SelectWinner<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(mut)]
    pub raffle: Account<'info, Raffle>,
    
    /// CHECK: This account will be set as the winner
    pub winner_account: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct WinnerChoice<'info> {
    #[account(mut)]
    pub winner: Signer<'info>,
    
    #[account(mut)]
    pub raffle: Account<'info, Raffle>,
    
    #[account(mut)]
    pub treasury: SystemAccount<'info>,
    
    pub system_program: Program<'info, System>,
}

#[account]
pub struct Raffle {
    pub host: Pubkey,
    pub prize: String,
    pub entry_fee: u64,
    pub max_entries: u32,
    pub entries: u32,
    pub end_timestamp: i64,
    pub winner: Option<Pubkey>,
    pub created_at: i64,
}

#[error_code]
pub enum CustomError {
    #[msg("The raffle has already ended")]
    RaffleEnded,
    #[msg("The raffle is full")]
    RaffleFull,
    #[msg("Winner has already been selected")]
    WinnerAlreadySelected,
    #[msg("The raffle has not ended yet")]
    RaffleNotEnded,
    #[msg("No entries in the raffle")]
    NoEntries,
    #[msg("No winner has been selected yet")]
    NoWinnerSelected,
    #[msg("You are not the winner of this raffle")]
    NotTheWinner,
    #[msg("Invalid choice. Must be 0 or 1")]
    InvalidChoice,
}