import { Connection, PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import { SUPPORTED_TOKENS } from '@/config/tokens';
import { TokenError } from '@/utils/errors';

export class TokenService {
  constructor(private connection: Connection) {}

  async getTokenBalance(walletAddress: PublicKey, denom: string): Promise<number> {
    const token = SUPPORTED_TOKENS.find((t) => t.symbol === denom);
    if (!token) {
      throw new TokenError(`Unsupported token: ${denom}`);
    }

    try {
      if (denom === 'SOL') {
        const balance = await this.connection.getBalance(walletAddress);
        return balance / Math.pow(10, token.decimals);
      }

      if (!token.mintAddress) {
        throw new TokenError(`No mint address for token: ${denom}`);
      }

      const mintPubkey = new PublicKey(token.mintAddress);
      const tokenAccount = await getAssociatedTokenAddress(
        mintPubkey,
        walletAddress,
        true,
        TOKEN_PROGRAM_ID
      );

      try {
        const account = await getAccount(this.connection, tokenAccount);
        return Number(account.amount) / Math.pow(10, token.decimals);
      } catch (error) {
        if ((error as Error).message.includes('TokenAccountNotFound')) {
          return 0;
        }
        throw error;
      }
    } catch (error) {
      throw new TokenError(`Failed to get ${denom} balance`, error as Error);
    }
  }

  async getTokenAccount(walletAddress: PublicKey, mintAddress: string): Promise<PublicKey> {
    try {
      const mintPubkey = new PublicKey(mintAddress);
      return await getAssociatedTokenAddress(
        mintPubkey,
        walletAddress,
        true,
        TOKEN_PROGRAM_ID
      );
    } catch (error) {
      throw new TokenError('Failed to get token account', error as Error);
    }
  }

  async hasTokenAccount(walletAddress: PublicKey, mintAddress: string): Promise<boolean> {
    try {
      const tokenAccount = await this.getTokenAccount(walletAddress, mintAddress);
      await getAccount(this.connection, tokenAccount);
      return true;
    } catch (error) {
      if ((error as Error).message.includes('TokenAccountNotFound')) {
        return false;
      }
      throw new TokenError('Failed to check token account', error as Error);
    }
  }
} 