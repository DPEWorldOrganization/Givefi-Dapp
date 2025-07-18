use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use switchboard_solana::{VrfAccountData, VrfRequestRandomness, VrfSettle};

declare_id!("5MrnsrCYpTrbv4iZKD51Caz8sXnQVZFZPMZ31FwgcTqz");

#[program]
pub mod givefi {
    use super::*;

    pub fn initialize_program(ctx: Context<InitializeProgram>, treasury_wallet: Pubkey) -> Result<()> {
        let program_state = &mut ctx.accounts.program_state;
        program_state.authority = ctx.accounts.authority.key();
        program_state.treasury_wallet = treasury_wallet;
        program_state.total_giveaways = 0;
        program_state.bump = ctx.bumps.program_state;
        Ok(())
    }

    pub fn create_giveaway(
        ctx: Context<CreateGiveaway>,
        giveaway_id: u64,
        entry_cost_sol: u64,
        entry_cost_give: Option<u64>,
        max_entries: u64,
        min_participants: u64,
        prize_description: String,
        end_timestamp: i64,
        jackpot_option_enabled: bool,
        early_end_enabled: bool,
    ) -> Result<()> {
        let giveaway = &mut ctx.accounts.giveaway;
        let clock = Clock::get()?;

        require!(end_timestamp > clock.unix_timestamp, GivefiError::InvalidEndTime);
        require!(entry_cost_sol > 0, GivefiError::InvalidEntryPrice);
        require!(max_entries > 0, GivefiError::InvalidMaxEntries);
        require!(min_participants > 0 && min_participants <= max_entries, GivefiError::InvalidMinParticipants);
        require!(prize_description.len() <= 100, GivefiError::DescriptionTooLong);

        giveaway.id = giveaway_id;
        giveaway.authority = ctx.accounts.authority.key();
        giveaway.entry_cost_sol = entry_cost_sol;
        giveaway.entry_cost_give = entry_cost_give;
        giveaway.max_entries = max_entries;
        giveaway.min_participants = min_participants;
        giveaway.current_entries = 0;
        giveaway.sol_entries = 0;
        giveaway.give_entries = 0;
        giveaway.prize_description = prize_description;
        giveaway.end_timestamp = end_timestamp;
        giveaway.jackpot_option_enabled = jackpot_option_enabled;
        giveaway.early_end_enabled = early_end_enabled;
        giveaway.is_active = true;
        giveaway.winner = None;
        giveaway.prize_claimed = false;
        giveaway.jackpot_claimed = false;
        giveaway.is_successful = false;
        giveaway.randomness_requested = false;
        giveaway.bump = ctx.bumps.giveaway;

        let program_state = &mut ctx.accounts.program_state;
        program_state.total_giveaways += 1;

        Ok(())
    }

    pub fn enter_giveaway_sol(ctx: Context<EnterGiveawaySol>) -> Result<()> {
        let giveaway = &mut ctx.accounts.giveaway;
        let clock = Clock::get()?;

        require!(giveaway.is_active, GivefiError::GiveawayNotActive);
        require!(clock.unix_timestamp < giveaway.end_timestamp, GivefiError::GiveawayEnded);
        require!(giveaway.current_entries < giveaway.max_entries, GivefiError::MaxEntriesReached);

        let transfer_instruction = anchor_lang::system_program::Transfer {
            from: ctx.accounts.user.to_account_info(),
            to: ctx.accounts.giveaway_vault.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            transfer_instruction,
        );

        anchor_lang::system_program::transfer(cpi_ctx, giveaway.entry_cost_sol)?;

        let entry = &mut ctx.accounts.entry;
        entry.giveaway_id = giveaway.id;
        entry.user = ctx.accounts.user.key();
        entry.entry_number = giveaway.current_entries;
        entry.timestamp = clock.unix_timestamp;
        entry.payment_type = PaymentType::Sol;
        entry.claimed = false;
        entry.bump = ctx.bumps.entry;

        giveaway.current_entries += 1;
        giveaway.sol_entries += 1;

        Ok(())
    }

    pub fn enter_giveaway_give(ctx: Context<EnterGiveawayGive>) -> Result<()> {
        let giveaway = &mut ctx.accounts.giveaway;
        let clock = Clock::get()?;

        require!(giveaway.is_active, GivefiError::GiveawayNotActive);
        require!(clock.unix_timestamp < giveaway.end_timestamp, GivefiError::GiveawayEnded);
        require!(giveaway.current_entries < giveaway.max_entries, GivefiError::MaxEntriesReached);
        require!(giveaway.entry_cost_give.is_some(), GivefiError::GiveTokensNotAccepted);

        let transfer_instruction = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.giveaway_token_vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            transfer_instruction,
        );

        token::transfer(cpi_ctx, giveaway.entry_cost_give.unwrap())?;

        let entry = &mut ctx.accounts.entry;
        entry.giveaway_id = giveaway.id;
        entry.user = ctx.accounts.user.key();
        entry.entry_number = giveaway.current_entries;
        entry.timestamp = clock.unix_timestamp;
        entry.payment_type = PaymentType::Give;
        entry.claimed = false;
        entry.bump = ctx.bumps.entry;

        giveaway.current_entries += 1;
        giveaway.give_entries += 1;

        Ok(())
    }

    pub fn end_raffle_early(ctx: Context<EndRaffleEarly>) -> Result<()> {
        let giveaway = &mut ctx.accounts.giveaway;
        let clock = Clock::get()?;

        require!(giveaway.is_active, GivefiError::GiveawayNotActive);
        require!(giveaway.early_end_enabled, GivefiError::EarlyEndNotEnabled);
        require!(giveaway.current_entries >= giveaway.min_participants, GivefiError::MinParticipantsNotMet);
        require!(giveaway.authority == ctx.accounts.authority.key(), GivefiError::UnauthorizedEarlyEnd);
        require!(clock.unix_timestamp < giveaway.end_timestamp, GivefiError::GiveawayAlreadyEnded);

        giveaway.end_timestamp = clock.unix_timestamp;
        Ok(())
    }

    pub fn request_randomness(ctx: Context<RequestRandomness>) -> Result<()> {
        let giveaway = &mut ctx.accounts.giveaway;
        let clock = Clock::get()?;

        require!(giveaway.is_active, GivefiError::GiveawayNotActive);
        require!(clock.unix_timestamp >= giveaway.end_timestamp, GivefiError::GiveawayNotEnded);
        require!(giveaway.winner.is_none(), GivefiError::WinnerAlreadyDrawn);
        require!(giveaway.current_entries >= giveaway.min_participants, GivefiError::MinParticipantsNotMet);

        // Request randomness from Switchboard VRF
        let vrf_request = VrfRequestRandomness {
            authority: ctx.accounts.giveaway.to_account_info(),
            vrf: ctx.accounts.vrf.to_account_info(),
            oracle_queue: ctx.accounts.oracle_queue.to_account_info(),
            queue_authority: ctx.accounts.queue_authority.to_account_info(),
            data_buffer: ctx.accounts.data_buffer.to_account_info(),
            permission: ctx.accounts.permission.to_account_info(),
            escrow: ctx.accounts.escrow.to_account_info(),
            payer_wallet: ctx.accounts.payer.to_account_info(),
            payer_authority: ctx.accounts.payer.to_account_info(),
            recent_blockhashes: ctx.accounts.recent_blockhashes.to_account_info(),
            program_state: ctx.accounts.program_state.to_account_info(),
            token_program: ctx.accounts.token_program.to_account_info(),
        };

        let giveaway_id_bytes = giveaway.id.to_le_bytes();
        let seeds = &[b"giveaway", &giveaway_id_bytes[..], &[giveaway.bump]];
        let signer = &[&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.switchboard_program.to_account_info(),
            vrf_request,
            signer,
        );

        switchboard_solana::cpi::vrf_request_randomness(cpi_ctx)?;

        giveaway.randomness_requested = true;
        Ok(())
    }

    pub fn settle_randomness_and_pick_winner(ctx: Context<SettleRandomness>) -> Result<()> {
        let giveaway = &mut ctx.accounts.giveaway;

        require!(giveaway.is_active, GivefiError::GiveawayNotActive);
        require!(giveaway.randomness_requested, GivefiError::RandomnessNotRequested);
        require!(giveaway.winner.is_none(), GivefiError::WinnerAlreadyDrawn);

        // Settle the VRF and get the random result
        let vrf_settle = VrfSettle {
            vrf: ctx.accounts.vrf.to_account_info(),
            authority: ctx.accounts.giveaway.to_account_info(),
        };

        let giveaway_id_bytes = giveaway.id.to_le_bytes();
        let seeds = &[b"giveaway", &giveaway_id_bytes[..], &[giveaway.bump]];
        let signer = &[&seeds[..]];

        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.switchboard_program.to_account_info(),
            vrf_settle,
            signer,
        );

        switchboard_solana::cpi::vrf_settle(cpi_ctx)?;

        // Get the random result from the VRF account
        let vrf_account_info = &ctx.accounts.vrf;
        let vrf = VrfAccountData::new(vrf_account_info)?;
        let result_buffer = vrf.get_result()?;
        
        if result_buffer == [0u8; 32] {
            return Err(GivefiError::RandomnessNotSettled.into());
        }

        // Convert the random bytes to a number and pick winner
        let random_value = u64::from_le_bytes([
            result_buffer[0], result_buffer[1], result_buffer[2], result_buffer[3],
            result_buffer[4], result_buffer[5], result_buffer[6], result_buffer[7]
        ]);

        let winning_entry = random_value % giveaway.current_entries;
        giveaway.winner = Some(winning_entry);
        giveaway.is_successful = true;
        giveaway.is_active = false;

        Ok(())
    }

    pub fn draw_winner_fallback(ctx: Context<DrawWinner>) -> Result<()> {
        let giveaway = &mut ctx.accounts.giveaway;
        let clock = Clock::get()?;

        require!(giveaway.is_active, GivefiError::GiveawayNotActive);
        require!(clock.unix_timestamp >= giveaway.end_timestamp + 3600, GivefiError::FallbackTooEarly); // 1 hour after end
        require!(giveaway.winner.is_none(), GivefiError::WinnerAlreadyDrawn);

        if giveaway.current_entries >= giveaway.min_participants {
            giveaway.is_successful = true;
            // Use recent blockhash as fallback randomness source (better than timestamp)
            let recent_blockhashes = &ctx.accounts.recent_blockhashes;
            let most_recent = Clock::get()?.slot;
            
            // Use slot hash for randomness (still not perfect but better than timestamp)
            let slot_hash = recent_blockhashes.slot_hashes.get(0)
                .ok_or(GivefiError::SlotHashUnavailable)?;
            
            let random_bytes = slot_hash.hash.to_bytes();
            let random_num = u64::from_le_bytes([
                random_bytes[0], random_bytes[1], random_bytes[2], random_bytes[3],
                random_bytes[4], random_bytes[5], random_bytes[6], random_bytes[7]
            ]);

            let winning_entry = random_num % giveaway.current_entries;
            giveaway.winner = Some(winning_entry);
        } else {
            giveaway.is_successful = false;
        }

        giveaway.is_active = false;
        Ok(())
    }

    pub fn claim_prize(ctx: Context<ClaimPrize>) -> Result<()> {
        let giveaway = &mut ctx.accounts.giveaway;
        let entry = &mut ctx.accounts.entry;

        require!(!giveaway.is_active, GivefiError::GiveawayStillActive);
        require!(giveaway.is_successful, GivefiError::GiveawayNotSuccessful);
        require!(giveaway.winner.is_some(), GivefiError::NoWinnerDrawn);
        require!(!giveaway.prize_claimed && !giveaway.jackpot_claimed, GivefiError::PrizeAlreadyClaimed);
        require!(entry.entry_number == giveaway.winner.unwrap(), GivefiError::NotWinner);
        require!(entry.user == ctx.accounts.user.key(), GivefiError::UnauthorizedClaim);
        require!(!entry.claimed, GivefiError::PrizeAlreadyClaimed);

        giveaway.prize_claimed = true;
        entry.claimed = true;

        ctx.accounts.entry.close(ctx.accounts.treasury_wallet.to_account_info())?;

        Ok(())
    }

    pub fn claim_jackpot(ctx: Context<ClaimJackpot>) -> Result<()> {
    // Only borrow as immutable for CPI and calculations
    let entry = &mut ctx.accounts.entry;
    let _program_state = &ctx.accounts.program_state;

    require!(!ctx.accounts.giveaway.is_active, GivefiError::GiveawayStillActive);
    require!(ctx.accounts.giveaway.is_successful, GivefiError::GiveawayNotSuccessful);
    require!(ctx.accounts.giveaway.jackpot_option_enabled, GivefiError::JackpotNotEnabled);
    require!(ctx.accounts.giveaway.winner.is_some(), GivefiError::NoWinnerDrawn);
    require!(!ctx.accounts.giveaway.prize_claimed && !ctx.accounts.giveaway.jackpot_claimed, GivefiError::PrizeAlreadyClaimed);
    require!(entry.entry_number == ctx.accounts.giveaway.winner.unwrap(), GivefiError::NotWinner);
    require!(entry.user == ctx.accounts.user.key(), GivefiError::UnauthorizedClaim);
    require!(!entry.claimed, GivefiError::PrizeAlreadyClaimed);

    let giveaway = &ctx.accounts.giveaway; // immutable borrow for calculations

    let total_sol_collected = giveaway.sol_entries * giveaway.entry_cost_sol;
    let winner_sol_amount = (total_sol_collected * 33) / 100;
    let owner_sol_amount = (total_sol_collected * 60) / 100;
    let treasury_sol_amount = (total_sol_collected * 7) / 100;

    let giveaway_id_bytes = giveaway.id.to_le_bytes();
    let vault_seeds = &[b"giveaway_vault", &giveaway_id_bytes[..], &[ctx.bumps.giveaway_vault]];
    let vault_signer = &[&vault_seeds[..]];

    if winner_sol_amount > 0 {
        let transfer_instruction = anchor_lang::system_program::Transfer {
            from: ctx.accounts.giveaway_vault.to_account_info(),
            to: ctx.accounts.user.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            transfer_instruction,
            vault_signer,
        );
        anchor_lang::system_program::transfer(cpi_ctx, winner_sol_amount)?;
    }
    if owner_sol_amount > 0 {
        let transfer_instruction = anchor_lang::system_program::Transfer {
            from: ctx.accounts.giveaway_vault.to_account_info(),
            to: ctx.accounts.owner.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            transfer_instruction,
            vault_signer,
        );
        anchor_lang::system_program::transfer(cpi_ctx, owner_sol_amount)?;
    }
    if treasury_sol_amount > 0 {
        let transfer_instruction = anchor_lang::system_program::Transfer {
            from: ctx.accounts.giveaway_vault.to_account_info(),
            to: ctx.accounts.treasury_wallet.to_account_info(),
        };
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            transfer_instruction,
            vault_signer,
        );
        anchor_lang::system_program::transfer(cpi_ctx, treasury_sol_amount)?;
    }

    if giveaway.give_entries > 0 && giveaway.entry_cost_give.is_some() {
        let total_give_collected = giveaway.give_entries * giveaway.entry_cost_give.unwrap();
        let winner_give_amount = (total_give_collected * 33) / 100;
        let owner_give_amount = (total_give_collected * 60) / 100;
        let treasury_give_amount = (total_give_collected * 7) / 100;

        let id_bytes = giveaway.id.to_le_bytes();
        let seeds = &[b"giveaway", &id_bytes[..], &[giveaway.bump]];
        let signer = &[&seeds[..]];

        if winner_give_amount > 0 {
            let transfer_instruction = Transfer {
                from: ctx.accounts.giveaway_token_vault.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.giveaway.to_account_info(),
            };
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                transfer_instruction,
                signer,
            );
            token::transfer(cpi_ctx, winner_give_amount)?;
        }
        if owner_give_amount > 0 {
            let transfer_instruction = Transfer {
                from: ctx.accounts.giveaway_token_vault.to_account_info(),
                to: ctx.accounts.owner_token_account.to_account_info(),
                authority: ctx.accounts.giveaway.to_account_info(),
            };
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                transfer_instruction,
                signer,
            );
            token::transfer(cpi_ctx, owner_give_amount)?;
        }
        if treasury_give_amount > 0 {
            let transfer_instruction = Transfer {
                from: ctx.accounts.giveaway_token_vault.to_account_info(),
                to: ctx.accounts.treasury_token_account.to_account_info(),
                authority: ctx.accounts.giveaway.to_account_info(),
            };
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                transfer_instruction,
                signer,
            );
            token::transfer(cpi_ctx, treasury_give_amount)?;
        }
    }

    // Now, after all immutable borrows, borrow as mutable to update fields
    let giveaway = &mut ctx.accounts.giveaway;
    giveaway.jackpot_claimed = true;
    entry.claimed = true;

    ctx.accounts.entry.close(ctx.accounts.treasury_wallet.to_account_info())?;

    Ok(())
    }

    pub fn claim_refund(ctx: Context<ClaimRefund>) -> Result<()> {
        let giveaway = &ctx.accounts.giveaway;
        let entry = &mut ctx.accounts.entry;

        require!(!giveaway.is_active, GivefiError::GiveawayStillActive);
        require!(!giveaway.is_successful, GivefiError::GiveawayWasSuccessful);
        require!(entry.user == ctx.accounts.user.key(), GivefiError::UnauthorizedClaim);
        require!(!entry.claimed, GivefiError::PrizeAlreadyClaimed);

        match entry.payment_type {
            PaymentType::Sol => {
                let giveaway_id_bytes = giveaway.id.to_le_bytes();
                let vault_seeds = &[b"giveaway_vault", &giveaway_id_bytes[..], &[ctx.bumps.giveaway_vault]];
                let vault_signer = &[&vault_seeds[..]];

                let transfer_instruction = anchor_lang::system_program::Transfer {
                    from: ctx.accounts.giveaway_vault.to_account_info(),
                    to: ctx.accounts.user.to_account_info(),
                };
                let cpi_ctx = CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    transfer_instruction,
                    vault_signer,
                );
                anchor_lang::system_program::transfer(cpi_ctx, giveaway.entry_cost_sol)?;
            },
            PaymentType::Give => {
                let id_bytes = giveaway.id.to_le_bytes();
                let seeds = &[b"giveaway", &id_bytes[..], &[giveaway.bump]];
                let signer = &[&seeds[..]];

                let transfer_instruction = Transfer {
                    from: ctx.accounts.giveaway_token_vault.to_account_info(),
                    to: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.giveaway.to_account_info(),
                };
                let cpi_ctx = CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    transfer_instruction,
                    signer,
                );
                token::transfer(cpi_ctx, giveaway.entry_cost_give.unwrap())?;
            }
        }

        entry.claimed = true;
        ctx.accounts.entry.close(ctx.accounts.treasury_wallet.to_account_info())?;

        Ok(())
    }

    pub fn get_giveaway_info(ctx: Context<GetGiveawayInfo>) -> Result<()> {
        let giveaway = &ctx.accounts.giveaway;
        msg!("Giveaway {} Info:", giveaway.id);
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum PaymentType {
    Sol,
    Give,
}

#[derive(Accounts)]
pub struct InitializeProgram<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + ProgramState::INIT_SPACE,
        seeds = [b"program_state"],
        bump
    )]
    pub program_state: Account<'info, ProgramState>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(giveaway_id: u64)]
pub struct CreateGiveaway<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Giveaway::INIT_SPACE,
        seeds = [b"giveaway", giveaway_id.to_le_bytes().as_ref()],
        bump
    )]
    pub giveaway: Account<'info, Giveaway>,
    #[account(
        mut,
        seeds = [b"program_state"],
        bump = program_state.bump
    )]
    pub program_state: Account<'info, ProgramState>,
    /// CHECK: This is a PDA that will be used as a vault to hold SOL for the giveaway.
    /// It is derived from seeds and its address is verified through the PDA derivation.
    #[account(
        mut,
        seeds = [b"giveaway_vault", giveaway_id.to_le_bytes().as_ref()],
        bump
    )]
    pub giveaway_vault: UncheckedAccount<'info>,
    #[account(
        init,
        payer = authority,
        token::mint = give_mint,
        token::authority = giveaway,
        seeds = [b"token_vault", giveaway_id.to_le_bytes().as_ref()],
        bump
    )]
    pub giveaway_token_vault: Account<'info, TokenAccount>,
    pub give_mint: Account<'info, token::Mint>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct EnterGiveawaySol<'info> {
    #[account(
        mut,
        seeds = [b"giveaway", giveaway.id.to_le_bytes().as_ref()],
        bump = giveaway.bump
    )]
    pub giveaway: Account<'info, Giveaway>,
    #[account(
        init,
        payer = user,
        space = 8 + GiveawayEntry::INIT_SPACE,
        seeds = [b"entry", giveaway.id.to_le_bytes().as_ref(), giveaway.current_entries.to_le_bytes().as_ref()],
        bump
    )]
    pub entry: Account<'info, GiveawayEntry>,
    /// CHECK: This is a PDA that serves as a vault to hold SOL for the giveaway.
    /// It is derived from seeds and receives SOL transfers from users entering the giveaway.
    #[account(
        mut,
        seeds = [b"giveaway_vault", giveaway.id.to_le_bytes().as_ref()],
        bump
    )]
    pub giveaway_vault: UncheckedAccount<'info>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct EnterGiveawayGive<'info> {
    #[account(
        mut,
        seeds = [b"giveaway", giveaway.id.to_le_bytes().as_ref()],
        bump = giveaway.bump
    )]
    pub giveaway: Account<'info, Giveaway>,
    #[account(
        init,
        payer = user,
        space = 8 + GiveawayEntry::INIT_SPACE,
        seeds = [b"entry", giveaway.id.to_le_bytes().as_ref(), giveaway.current_entries.to_le_bytes().as_ref()],
        bump
    )]
    pub entry: Account<'info, GiveawayEntry>,
    #[account(
        mut,
        token::mint = give_mint,
        token::authority = user
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"token_vault", giveaway.id.to_le_bytes().as_ref()],
        bump
    )]
    pub giveaway_token_vault: Account<'info, TokenAccount>,
    pub give_mint: Account<'info, token::Mint>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct EndRaffleEarly<'info> {
    #[account(
        mut,
        seeds = [b"giveaway", giveaway.id.to_le_bytes().as_ref()],
        bump = giveaway.bump
    )]
    pub giveaway: Account<'info, Giveaway>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct RequestRandomness<'info> {
    #[account(
        mut,
        seeds = [b"giveaway", giveaway.id.to_le_bytes().as_ref()],
        bump = giveaway.bump
    )]
    pub giveaway: Account<'info, Giveaway>,
    pub authority: Signer<'info>,
    /// CHECK: Switchboard VRF account
    #[account(mut)]
    pub vrf: AccountInfo<'info>,
    /// CHECK: Switchboard Oracle Queue account
    pub oracle_queue: AccountInfo<'info>,
    /// CHECK: Switchboard Queue Authority
    pub queue_authority: AccountInfo<'info>,
    /// CHECK: Switchboard Data Buffer
    pub data_buffer: AccountInfo<'info>,
    /// CHECK: Switchboard Permission account
    pub permission: AccountInfo<'info>,
    /// CHECK: Switchboard Escrow account
    #[account(mut)]
    pub escrow: AccountInfo<'info>,
    /// CHECK: Recent blockhashes sysvar
    pub recent_blockhashes: AccountInfo<'info>,
    /// CHECK: Switchboard program state
    pub program_state: AccountInfo<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    /// CHECK: Switchboard program
    pub switchboard_program: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct SettleRandomness<'info> {
    #[account(
        mut,
        seeds = [b"giveaway", giveaway.id.to_le_bytes().as_ref()],
        bump = giveaway.bump
    )]
    pub giveaway: Account<'info, Giveaway>,
    pub authority: Signer<'info>,
    /// CHECK: Switchboard VRF account
    #[account(mut)]
    pub vrf: AccountInfo<'info>,
    /// CHECK: Switchboard program
    pub switchboard_program: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct DrawWinner<'info> {
    #[account(
        mut,
        seeds = [b"giveaway", giveaway.id.to_le_bytes().as_ref()],
        bump = giveaway.bump
    )]
    pub giveaway: Account<'info, Giveaway>,
    pub authority: Signer<'info>,
    /// CHECK: Recent blockhashes sysvar
    pub recent_blockhashes: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct ClaimPrize<'info> {
    #[account(
        mut,
        seeds = [b"giveaway", giveaway.id.to_le_bytes().as_ref()],
        bump = giveaway.bump
    )]
    pub giveaway: Account<'info, Giveaway>,
    #[account(
        mut,
        seeds = [b"entry", giveaway.id.to_le_bytes().as_ref(), entry.entry_number.to_le_bytes().as_ref()],
        bump = entry.bump
    )]
    pub entry: Account<'info, GiveawayEntry>,
    #[account(mut)]
    pub user: Signer<'info>,
    /// CHECK: This account is validated to match the treasury_wallet stored in program_state.
    /// The address constraint ensures this is the correct treasury wallet.
    #[account(
        mut,
        address = program_state.treasury_wallet
    )]
    pub treasury_wallet: UncheckedAccount<'info>,
    #[account(
        seeds = [b"program_state"],
        bump = program_state.bump
    )]
    pub program_state: Account<'info, ProgramState>,
}

#[derive(Accounts)]
pub struct ClaimJackpot<'info> {
    #[account(
        mut,
        seeds = [b"giveaway", giveaway.id.to_le_bytes().as_ref()],
        bump = giveaway.bump
    )]
    pub giveaway: Account<'info, Giveaway>,
    #[account(
        mut,
        seeds = [b"entry", giveaway.id.to_le_bytes().as_ref(), entry.entry_number.to_le_bytes().as_ref()],
        bump = entry.bump
    )]
    pub entry: Account<'info, GiveawayEntry>,
    #[account(
        seeds = [b"program_state"],
        bump = program_state.bump
    )]
    pub program_state: Account<'info, ProgramState>,
    /// CHECK: This is a PDA that serves as a vault holding SOL for the giveaway.
    /// It is derived from seeds and SOL is transferred from it during jackpot claims.
    #[account(
        mut,
        seeds = [b"giveaway_vault", giveaway.id.to_le_bytes().as_ref()],
        bump
    )]
    pub giveaway_vault: UncheckedAccount<'info>,
    #[account(
        mut,
        token::mint = give_mint,
        token::authority = user
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = give_mint,
        token::authority = owner
    )]
    pub owner_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = give_mint
    )]
    pub treasury_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"token_vault", giveaway.id.to_le_bytes().as_ref()],
        bump
    )]
    pub giveaway_token_vault: Account<'info, TokenAccount>,
    pub give_mint: Account<'info, token::Mint>,
    #[account(mut)]
    pub user: Signer<'info>,
    /// CHECK: This account must be the giveaway authority/owner who receives a portion of the jackpot.
    /// It is validated through the constraint below to ensure security.
    #[account(
        mut,
        constraint = owner.key() == giveaway.authority @ GivefiError::InvalidOwner
    )]
    pub owner: UncheckedAccount<'info>,
    /// CHECK: This account is validated to match the treasury_wallet stored in program_state.
    /// The address constraint ensures this is the correct treasury wallet.
    #[account(
        mut,
        address = program_state.treasury_wallet
    )]
    pub treasury_wallet: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimRefund<'info> {
    #[account(
        seeds = [b"giveaway", giveaway.id.to_le_bytes().as_ref()],
        bump = giveaway.bump
    )]
    pub giveaway: Account<'info, Giveaway>,
    #[account(
        mut,
        seeds = [b"entry", giveaway.id.to_le_bytes().as_ref(), entry.entry_number.to_le_bytes().as_ref()],
        bump = entry.bump
    )]
    pub entry: Account<'info, GiveawayEntry>,
    /// CHECK: This is a PDA that serves as a vault holding SOL for the giveaway.
    /// It is derived from seeds and SOL is refunded from it when giveaway fails.
    #[account(
        mut,
        seeds = [b"giveaway_vault", giveaway.id.to_le_bytes().as_ref()],
        bump
    )]
    pub giveaway_vault: UncheckedAccount<'info>,
    #[account(
        mut,
        token::mint = give_mint,
        token::authority = user
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"token_vault", giveaway.id.to_le_bytes().as_ref()],
        bump
    )]
    pub giveaway_token_vault: Account<'info, TokenAccount>,
    pub give_mint: Account<'info, token::Mint>,
    #[account(mut)]
    pub user: Signer<'info>,
    /// CHECK: This account is validated to match the treasury_wallet stored in program_state.
    /// The address constraint ensures this is the correct treasury wallet.
    #[account(
        mut,
        address = program_state.treasury_wallet
    )]
    pub treasury_wallet: UncheckedAccount<'info>,
    #[account(
        seeds = [b"program_state"],
        bump = program_state.bump
    )]
    pub program_state: Account<'info, ProgramState>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GetGiveawayInfo<'info> {
    #[account(
        seeds = [b"giveaway", giveaway.id.to_le_bytes().as_ref()],
        bump = giveaway.bump
    )]
    pub giveaway: Account<'info, Giveaway>,
}

#[account]
#[derive(InitSpace)]
pub struct ProgramState {
    pub authority: Pubkey,
    pub treasury_wallet: Pubkey,
    pub total_giveaways: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Giveaway {
    pub id: u64,
    pub authority: Pubkey,
    pub entry_cost_sol: u64,
    pub entry_cost_give: Option<u64>,
    pub max_entries: u64,
    pub min_participants: u64,
    pub current_entries: u64,
    pub sol_entries: u64,
    pub give_entries: u64,
    #[max_len(100)]
    pub prize_description: String,
    pub end_timestamp: i64,
    pub jackpot_option_enabled: bool,
    pub early_end_enabled: bool,
    pub is_active: bool,
    pub is_successful: bool,
    pub winner: Option<u64>,
    pub prize_claimed: bool,
    pub jackpot_claimed: bool,
    pub randomness_requested: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct GiveawayEntry {
    pub giveaway_id: u64,
    pub user: Pubkey,
    pub entry_number: u64,
    pub timestamp: i64,
    pub payment_type: PaymentType,
    pub claimed: bool,
    pub bump: u8,
}

#[error_code]
pub enum GivefiError {
    #[msg("Invalid end time for giveaway")]
    InvalidEndTime,
    #[msg("Invalid entry price")]
    InvalidEntryPrice,
    #[msg("Invalid max entries")]
    InvalidMaxEntries,
    #[msg("Invalid minimum participants")]
    InvalidMinParticipants,
    #[msg("Description too long")]
    DescriptionTooLong,
    #[msg("Giveaway is not active")]
    GiveawayNotActive,
    #[msg("Giveaway has ended")]
    GiveawayEnded,
    #[msg("Maximum entries reached")]
    MaxEntriesReached,
    #[msg("Giveaway has not ended yet")]
    GiveawayNotEnded,
    #[msg("No entries in giveaway")]
    NoEntries,
    #[msg("Winner already drawn")]
    WinnerAlreadyDrawn,
    #[msg("Slot hash unavailable")]
    SlotHashUnavailable,
    #[msg("Giveaway is still active")]
    GiveawayStillActive,
    #[msg("No winner drawn yet")]
    NoWinnerDrawn,
    #[msg("Prize already claimed")]
    PrizeAlreadyClaimed,
    #[msg("Not the winner")]
    NotWinner,
    #[msg("Unauthorized claim")]
    UnauthorizedClaim,
    #[msg("GIVE tokens not accepted for this giveaway")]
    GiveTokensNotAccepted,
    #[msg("Giveaway was not successful")]
    GiveawayNotSuccessful,
    #[msg("Giveaway was successful, no refunds")]
    GiveawayWasSuccessful,
    #[msg("Jackpot option not enabled for this giveaway")]
    JackpotNotEnabled,
    #[msg("Early end not enabled for this giveaway")]
    EarlyEndNotEnabled,
    #[msg("Minimum participants not yet met")]
    MinParticipantsNotMet,
    #[msg("Unauthorized to end raffle early")]
    UnauthorizedEarlyEnd,
    #[msg("Giveaway already ended")]
    GiveawayAlreadyEnded,
    #[msg("Randomness not requested yet")]
    RandomnessNotRequested,
    #[msg("Randomness not settled yet")]
    RandomnessNotSettled,
    #[msg("Fallback randomness can only be used 1 hour after giveaway end")]
    FallbackTooEarly,
    #[msg("Invalid owner - must be giveaway authority")]
    InvalidOwner,
}