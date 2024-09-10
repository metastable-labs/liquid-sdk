import { Address, PublicClient, erc20Abi, parseUnits, formatUnits } from 'viem';
import { TokenInfo } from '../types';

export async function getTokenBalance(
  publicClient: PublicClient,
  tokenAddress: Address,
  userAddress: Address,
): Promise<string> {
  const balance = (await publicClient.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [userAddress],
  })) as bigint;

  return balance.toString();
}

export async function getTokenList(): Promise<TokenInfo[]> {
  // This is a placeholder implementation. we'll replace this with an actual token list
  return [
    { address: '0x...' as Address, symbol: 'WETH', decimals: 18 },
    { address: '0x...' as Address, symbol: 'USDC', decimals: 6 },
  ];
}

/**
 * Calculates the minimum amount based on the input amount and slippage tolerance.
 * @param amount The input amount as a string (can include decimals)
 * @param tokenInfo The token information (including decimals)
 * @param slippageTolerance The slippage tolerance as a percentage (e.g., 0.5 for 0.5%)
 * @returns The minimum amount as a BigInt
 */
export function calculateMinAmount(amount: string, tokenInfo: TokenInfo): bigint {
  const parsedAmount = parseUnits(amount, tokenInfo.decimals);
  const slippageFactor = 10000n - BigInt(0.2 * 100);
  const minAmount = (parsedAmount * slippageFactor) / 10000n;
  return minAmount;
}

/**
 * Calculates the deadline for a transaction.
 * @param minutesFromNow The number of minutes from now when the transaction should expire
 * @returns The deadline as a BigInt (unix timestamp)
 */
export function calculateDeadline(minutesFromNow: number = 20): bigint {
  const deadlineMs = Date.now() + minutesFromNow * 60 * 1000;
  return BigInt(Math.floor(deadlineMs / 1000));
}

/**
 * Formats the result amount for display, considering token decimals.
 * @param amount The amount as a BigInt
 * @param tokenInfo The token information (including decimals)
 * @returns The formatted amount as a string
 */
export function formatAmount(amount: bigint, tokenInfo: TokenInfo): string {
  return formatUnits(amount, tokenInfo.decimals);
}
