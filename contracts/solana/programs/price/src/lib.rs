use anchor_lang::prelude::*;

declare_id!("Gv2fULFa8SDCYJWaJZSwHEsayEoNDVFvXk53qygQopp6");

#[program]
pub mod price {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
