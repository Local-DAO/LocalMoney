use anchor_lang::prelude::*;
use solana_program::{
    instruction::{AccountMeta, Instruction},
    program::invoke,
    pubkey::Pubkey,
};

pub fn verify_price(
    price_program: &AccountInfo,
    price_oracle: &AccountInfo,
    trade_price: u64,
) -> Result<()> {
    let price_accounts = vec![AccountMeta::new_readonly(price_oracle.key(), false)];

    invoke(
        &Instruction {
            program_id: *price_program.key,
            accounts: price_accounts,
            data: vec![0, trade_price.to_le_bytes().to_vec()].concat(),
        },
        &[price_oracle.to_account_info()],
    )?;

    Ok(())
}

pub fn verify_offer(offer_program: &AccountInfo, offer: &AccountInfo) -> Result<()> {
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

pub fn update_profile_stats(
    profile_program: &AccountInfo,
    buyer_profile: &AccountInfo,
    seller_profile: &AccountInfo,
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

pub fn verify_trade_completion(trade_program: &AccountInfo, trade: &AccountInfo) -> Result<()> {
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
