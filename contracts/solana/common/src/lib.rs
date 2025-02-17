use anchor_lang::prelude::*;
use solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke,
};

pub fn verify_price<'info>(
    price_program: &AccountInfo<'info>,
    price_oracle: &AccountInfo<'info>,
    trade_price: u64,
) -> Result<()> {
    let price_accounts = vec![AccountMeta::new_readonly(price_oracle.key(), false)];
    let mut data = vec![0];
    data.extend_from_slice(&trade_price.to_le_bytes());

    invoke(
        &Instruction {
            program_id: *price_program.key,
            accounts: price_accounts,
            data,
        },
        &[price_oracle.to_account_info()],
    )?;

    Ok(())
}

pub fn verify_offer<'info>(
    offer_program: &AccountInfo<'info>,
    offer: &AccountInfo<'info>,
) -> Result<()> {
    let offer_accounts = vec![AccountMeta::new(offer.key(), false)];

    invoke(
        &Instruction {
            program_id: *offer_program.key,
            accounts: offer_accounts,
            data: vec![1], // Verification instruction
        },
        &[offer.to_account_info()],
    )?;

    Ok(())
}

pub fn update_profile_stats<'info>(
    profile_program: &AccountInfo<'info>,
    buyer_profile: &AccountInfo<'info>,
    seller_profile: &AccountInfo<'info>,
) -> Result<()> {
    let profile_accounts = vec![
        AccountMeta::new(buyer_profile.key(), false),
        AccountMeta::new(seller_profile.key(), false),
    ];

    invoke(
        &Instruction {
            program_id: *profile_program.key,
            accounts: profile_accounts,
            data: vec![2], // Update stats instruction
        },
        &[
            buyer_profile.to_account_info(),
            seller_profile.to_account_info(),
        ],
    )?;

    Ok(())
}

pub fn verify_trade_completion<'info>(
    trade_program: &AccountInfo<'info>,
    trade: &AccountInfo<'info>,
) -> Result<()> {
    let trade_accounts = vec![AccountMeta::new_readonly(trade.key(), false)];

    invoke(
        &Instruction {
            program_id: *trade_program.key,
            accounts: trade_accounts,
            data: vec![3], // Trade completion verification instruction
        },
        &[trade.to_account_info()],
    )?;

    Ok(())
}
