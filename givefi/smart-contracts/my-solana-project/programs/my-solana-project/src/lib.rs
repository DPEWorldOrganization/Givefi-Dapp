use anchor_lang::prelude::*;

declare_id!("HzuwXBCFCCeYet6HDJseRNvQeMsEjreEU5AUajkbiZPb");

#[program]
pub mod my_solana_project {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
